import { emit } from './utils'
import { isWatchUrl } from '../lib/split-watch-url'
import { installSplitPlayerWindow } from './split-player-window'
import { findSplitLink } from './split-link'

// Page half of the split watch view (see lib/split-view.ts). Two webviews are
// live at once and each one only handles the pages it owns, so every link that
// belongs to the other one is handed over to the app instead of being followed
// here.
//
// Clicks are caught in the capture phase, before YouTube's own router sees
// them, because cancelling a navigation the SPA already started is not
// something the page can undo. The navigation guard below is the net for the
// ones that never went through a link.

const YOUTUBE_HOSTS = ['m.youtube.com', 'www.youtube.com', 'youtube.com', 'music.youtube.com']

// How long the location has to hold still before the guard believes it.
const SETTLE_MS = 400

type Role = 'browse' | 'player'

const isWatch = (url: URL) => isWatchUrl(url.href)

function role(): Role | null {
  const value = (window as any).NouTubeRole
  return value === 'browse' || value === 'player' ? value : null
}

function resolve(href: string | null | undefined): URL | null {
  if (!href) {
    return null
  }
  try {
    const url = new URL(href, location.href)
    return YOUTUBE_HOSTS.includes(url.host) ? url : null
  } catch {
    return null
  }
}

/* The page this webview is not responsible for. */
function belongsToOtherView(url: URL, current: Role) {
  return current === 'browse' ? isWatch(url) : !isWatch(url)
}

function handoff(url: URL, current: Role) {
  emit(current === 'browse' ? 'open-watch' : 'open-page', { url: url.href })
}

function installClickHandoff(current: Role) {
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return
      }
      const link = findSplitLink(event)
      if (!link || link.target === '_blank') {
        return
      }
      const url = resolve(link.href)
      if (!url || !belongsToOtherView(url, current)) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      handoff(url, current)
    },
    true,
  )
}

// The player's history is kept one deep: watch -> watch replaces instead of
// pushing. Back out of the player is the app's job and always lands on the
// browsing webview (see handleSplitBack), so an in-page stack of previous
// videos buys nothing -- and it actively hurts, because the guard below steps
// back through it and would surface a video the user never asked for.
function installPlayerHistoryCollapse() {
  const original = history.pushState
  history.pushState = function (this: History, ...args: any[]) {
    const target = resolve(typeof args[2] === 'string' ? args[2] : location.href)
    const here = resolve(location.href)
    if (target && here && isWatch(target) && isWatch(here)) {
      return history.replaceState.apply(this, args as any)
    }
    return original.apply(this, args as any)
  } as any
}

/* Anything that reached the wrong page without a link -- YouTube's own
 * redirects, autoplay, a script navigation -- is handed over after the fact and
 * the page is sent back where it came from. */
function installNavigationGuard(current: Role) {
  let lastHandled = ''

  const check = () => {
    const url = resolve(location.href)
    if (!url || !belongsToOtherView(url, current)) {
      lastHandled = ''
      return
    }
    if (url.href === lastHandled) return
    lastHandled = url.href
    handoff(url, current)
    try {
      history.back()
    } catch {}
  }

  // YouTube's router passes through intermediate urls on its way to the page it
  // is actually opening, so the guard waits for the location to settle. Acting
  // on one of those would hand over a page the user never went to.
  let pending: ReturnType<typeof setTimeout> | undefined
  const later = () => {
    clearTimeout(pending)
    const seen = location.href
    pending = setTimeout(() => {
      if (location.href === seen) {
        check()
      }
    }, SETTLE_MS)
  }

  window.addEventListener('popstate', later)
  window.addEventListener('yt-navigate-finish', later)
  document.addEventListener('yt-navigate-finish', later)

  for (const key of ['pushState', 'replaceState'] as const) {
    const original = history[key]
    history[key] = function (this: History, ...args: any[]) {
      const result = original.apply(this, args as any)
      later()
      return result
    } as any
  }
}

/* Opening another video in the player that is already showing one: a click on a
 * same-origin watch link is picked up by YouTube's own router, which is a great
 * deal cheaper than loading the watch page as a fresh document. An anchor
 * click navigates either way, so there is nothing to fall back to if the router
 * does not take it. Returns true so the native side can tell a navigation that
 * happened from one that never reached the page at all (see loadIntoPlayer). */
export function navigateWatch(url: string) {
  try {
    const target = new URL(url, location.href)
    const anchor = document.createElement('a')
    anchor.href = target.href
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } catch {
    location.href = url
  }
  return true
}

// The native mini player is the same live page in a small box, so the page has
// to lay itself out for it: everything but the video gets out of the way, and
// comes straight back on the way up. Nothing is torn down, which is the whole
// point -- the old mini player was a separate /embed iframe and had to start
// the video over.
const MINI_CLASS = '_nou_native_mini'
const MINI_STYLE_ID = '_nou_native_mini_style'

const miniCss = `
  html.${MINI_CLASS}, html.${MINI_CLASS} body {
    overflow: hidden !important;
    background: #000 !important;
  }
  /* The mobile player's parent has its own stacking context. A body backdrop
     covers that entire context, regardless of the video's z-index. Hide the
     surrounding page instead, keeping the live player in its original DOM. */
  html.${MINI_CLASS} body * {
    visibility: hidden !important;
  }
  html.${MINI_CLASS} #movie_player,
  html.${MINI_CLASS} #movie_player * {
    visibility: visible !important;
  }
  /* Ancestors must not clip or offset the fixed player in the small viewport. */
  html.${MINI_CLASS} body :has(#movie_player) {
    position: static !important;
    transform: none !important;
    contain: none !important;
    overflow: visible !important;
  }
  html.${MINI_CLASS} #movie_player {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    z-index: 2147483647 !important;
    background: #000 !important;
  }
  /* The player sizes its video in inline pixels, which the rule above does not
     touch, so the video has to be told to fill the box as well. */
  html.${MINI_CLASS} #movie_player .html5-video-container,
  html.${MINI_CLASS} #movie_player video {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    left: 0 !important;
    top: 0 !important;
    object-fit: contain !important;
  }
  /* Controls are the app's job in the mini player: the box is too small to hit
     anything, and a tap on it means "give me the video back". */
  html.${MINI_CLASS} #movie_player .ytp-chrome-top,
  html.${MINI_CLASS} #movie_player .ytp-chrome-bottom,
  html.${MINI_CLASS} #movie_player #player-control-overlay,
  html.${MINI_CLASS} #movie_player .ytp-gradient-top,
  html.${MINI_CLASS} #movie_player .ytp-gradient-bottom {
    display: none !important;
  }
`

export function setNativeMini(enabled: boolean) {
  const root = document.documentElement
  if (!root) {
    return
  }
  if (enabled && !document.getElementById(MINI_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = MINI_STYLE_ID
    style.textContent = miniCss
    ;(document.head || root).appendChild(style)
  }
  root.classList.toggle(MINI_CLASS, Boolean(enabled))
  // The player only recomputes its layout when it thinks the window moved.
  try {
    window.dispatchEvent(new Event('resize'))
  } catch {}
}

/* The player owns the audio while it is loaded, so the browsing webview is
 * silenced from the app side (see syncBrowseMute). */
let muted = false
let muteObserver: MutationObserver | null = null
// Only ever unmute what this muted: YouTube mutes its own feed previews, and
// handing them the sound back would be worse than leaving them silent.
const mutedByUs = new WeakSet<HTMLMediaElement>()

function applyMute() {
  for (const node of Array.from(document.querySelectorAll('video, audio'))) {
    const media = node as HTMLMediaElement
    if (muted) {
      if (!media.muted) {
        media.muted = true
        mutedByUs.add(media)
      }
    } else if (mutedByUs.has(media)) {
      mutedByUs.delete(media)
      media.muted = false
    }
  }
}

export function setMuted(next: boolean) {
  muted = Boolean(next)
  applyMute()
  if (muted && !muteObserver) {
    muteObserver = new MutationObserver(() => applyMute())
    muteObserver.observe(document.documentElement, { childList: true, subtree: true })
  } else if (!muted && muteObserver) {
    muteObserver.disconnect()
    muteObserver = null
  }
}

export function installSplitView() {
  const current = role()
  if (!current || location.host === 'music.youtube.com') {
    return
  }
  const root = window as any
  if (root.__nouSplitViewInstalled) {
    return
  }
  root.__nouSplitViewInstalled = true

  installClickHandoff(current)
  installNavigationGuard(current)
  if (current === 'player') {
    installSplitPlayerWindow()
    installPlayerHistoryCollapse()
  }

  // A load inside the mini player -- the queue advancing, say -- starts the
  // page over, so the app hands the mode down with the prelude and it is
  // applied here at document start rather than after the page has drawn itself
  // full size.
  if ((window as any).NouTubeNativeMini) {
    setNativeMini(true)
  }
}
