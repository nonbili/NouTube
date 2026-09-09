import { ObservableHint } from '@legendapp/state'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { isAndroid } from './utils'
import { isWatchUrl } from './split-watch-url'

export { isWatchUrl } from './split-watch-url'

// Split watch view: an opt-in Android layout where /watch runs in a second
// webview stacked on top of the browsing one.
//
// The browsing webview never leaves the feed, so coming back from a video is
// instant and keeps its scroll position, and the video keeps playing while the
// user browses. Back is deliberately flat: from the player it always returns to
// the browsing webview rather than stepping through the videos visited inside
// it, so the two history stacks never have to be merged into one order.
//
// Only /watch splits. /shorts is a feed of its own and stays with browsing.

let browseWebview: any = null
let playerWebview: any = null
// Set while the player webview has not attached yet, so the first video opened
// after enabling the split is not dropped on the floor.
let pendingPlayerUrl = ''
// Bumped by everything that makes an in-flight player load obsolete. The
// navigation handshake below is asynchronous, and by the time it answers the
// video may have been closed or replaced by a newer one -- its fallback has to
// know it is stale rather than pulling a dead video back onto the screen.
let playerLoadToken = 0

export function isSplitWatchEnabled() {
  return isAndroid && settings$.separateWatchView.get()
}

export function isShortsUrl(url: string) {
  try {
    return new URL(url).pathname.startsWith('/shorts')
  } catch {
    return false
  }
}

/* The webview the user is looking at, which is the one every page-level action
 * -- bookmarking, sharing, downloading, reloading -- has to talk to. The mini
 * player does not count: it is a corner of the browsing page, not the page. */
export function syncForegroundWebview() {
  const showingPlayer = ui$.playerMode.get() === 'full' && Boolean(playerWebview)
  const foreground = showingPlayer ? playerWebview : browseWebview
  if (foreground && ui$.webview.peek() !== foreground) {
    ui$.webview.set(ObservableHint.opaque(foreground))
  }
  if (!isSplitWatchEnabled()) {
    return
  }
  const pageUrl = showingPlayer ? ui$.playerPageUrl.get() : ui$.browsePageUrl.get()
  if (pageUrl) {
    ui$.pageUrl.set(pageUrl)
  }
}

export function setBrowseWebview(webview: any) {
  browseWebview = webview
  syncForegroundWebview()
}

export function setPlayerWebview(webview: any) {
  playerWebview = webview
  playerLoadToken++
  syncForegroundWebview()
  if (webview && pendingPlayerUrl) {
    const url = pendingPlayerUrl
    pendingPlayerUrl = ''
    loadIntoPlayer(url)
  }
}

/* A load starts the page over, so the mini presentation has to be re-applied --
 * the queue advancing while the mini player is up is the case that needs it. */
export function reapplyPlayerMode() {
  applyPlayerMode(ui$.playerMode.get())
}

export function getBrowseWebview() {
  return browseWebview
}

export function getPlayerWebview() {
  return playerWebview
}

/* The page lays itself out for the box it is given: in the mini player it
 * strips everything but the video, and gets it all back on the way up. Nothing
 * reloads, so the video never loses a frame or its position. */
function applyPlayerMode(mode: 'full' | 'mini' | 'hidden') {
  ui$.playerMode.set(mode)
  try {
    void playerWebview
      ?.executeJavaScript?.(`window.NouTube?.setNativeMini?.(${mode === 'mini'})`)
      ?.catch?.(() => undefined)
  } catch {}
  syncForegroundWebview()
}

export function showPlayer() {
  if (!ui$.playerUrl.get()) {
    return
  }
  applyPlayerMode('full')
}

/* Leaving the video: it shrinks into the mini player when that is on, and
 * otherwise waits offscreen, still playing either way. */
export function hidePlayer() {
  if (!ui$.playerUrl.get()) {
    return
  }
  applyPlayerMode(settings$.miniPlayer.get() ? 'mini' : 'hidden')
}

/* Returning to the page already behind the player should only reveal it.
 * Loading that URL again discards the feed and its scroll position. */
export function openInBrowse(url: string) {
  hidePlayer()
  try {
    if (new URL(url).href === new URL(ui$.browsePageUrl.get()).href) return
  } catch {}
  browseWebview?.loadUrl?.(url)
}

/* Tear the video down for good. The webview itself stays for the next one --
 * it is kept warm on purpose -- so it has to be emptied rather than dropped,
 * or it would go on playing with nothing on screen to stop it. */
export function closePlayer() {
  pausePlayer()
  pendingPlayerUrl = ''
  playerLoadToken++
  // Through applyPlayerMode rather than setting the mode directly: the page has
  // to be told to drop the mini layout even when the about:blank load below
  // never happens, or it is left stripped down to a fixed full-viewport player.
  applyPlayerMode('hidden')
  ui$.playerUrl.set('')
  ui$.playerPageUrl.set('')
  playerWebview?.loadUrl?.('about:blank')
  syncForegroundWebview()
}

export function pausePlayer() {
  try {
    void playerWebview?.executeJavaScript?.('window.NouTube?.pause?.()')?.catch?.(() => undefined)
  } catch {}
}

function loadIntoPlayer(url: string) {
  const webview = playerWebview
  const token = ++playerLoadToken
  if (!webview) {
    pendingPlayerUrl = url
    return
  }
  // A player already sitting on a watch page has YouTube's router live in it,
  // and letting the router do the navigation is far cheaper than loading the
  // watch page as a fresh document -- the same trick the site itself uses when
  // you tap a video in the feed.
  if (isWatchUrl(ui$.playerPageUrl.get())) {
    try {
      // The page answers with a sentinel: without one, a player that has not
      // installed window.NouTube yet -- still loading, a recovered renderer, an
      // interstitial that kept the /watch path -- would resolve having done
      // nothing at all and silently drop the video.
      const navigating = webview.executeJavaScript?.(
        `window.NouTube?.navigateWatch?.(${JSON.stringify(url)}) ? 'navigated' : 'no-bridge'`,
      )
      if (navigating?.then) {
        // Onto the webview this started on, and only while this is still the
        // load the app is waiting for.
        const fallback = () => {
          if (token !== playerLoadToken || playerWebview !== webview) {
            return
          }
          webview.loadUrl?.(url)
        }
        void navigating
          .then((result: unknown) => {
            if (result !== 'navigated') {
              fallback()
            }
          })
          .catch(fallback)
        return
      }
    } catch {}
  }
  webview.loadUrl?.(url)
}

/**
 * Show a video in the player.
 *
 * `keepMode` leaves the presentation alone, for the times the app moves the
 * player along on its own: the queue advancing while the mini player is up
 * should stay in the mini player, not throw the video back in the user's face.
 */
export function openInPlayer(url: string, { keepMode = false }: { keepMode?: boolean } = {}) {
  ui$.playerUrl.set(url)
  if (!keepMode) {
    applyPlayerMode('full')
  }
  loadIntoPlayer(url)
}

/* The url each webview last landed on. Only the foreground one is the page the
 * toolbar, bookmarks and sharing act on. */
export function setSplitPageUrl(view: 'browse' | 'player', url: string) {
  if (!url || url === 'about:blank') {
    return
  }
  if (view === 'browse') {
    ui$.browsePageUrl.set(url)
    try {
      settings$.home.set(new URL(url).host === 'music.youtube.com' ? 'yt-music' : 'yt')
    } catch {}
  } else {
    ui$.playerPageUrl.set(url)
  }
  syncForegroundWebview()
  if (view === 'browse') {
    syncBrowseMute()
  }
}

/* Back from the player always lands on the browsing webview, never on the
 * previous video. Returns true when the press was consumed. */
export function handleSplitBack() {
  if (!isSplitWatchEnabled() || ui$.playerMode.get() !== 'full') {
    return false
  }
  hidePlayer()
  return true
}

/* Two live webviews, one media session: the player owns the audio, so the
 * browsing side is muted while a video is loaded. Shorts are the exception --
 * they are the browsing side's own playback, so they take the audio back and
 * pause the player instead. */
export function syncBrowseMute() {
  const hasPlayer = Boolean(ui$.playerUrl.get())
  const browsingShorts = isShortsUrl(ui$.browsePageUrl.get())
  const muted = hasPlayer && !browsingShorts
  try {
    void browseWebview?.executeJavaScript?.(`window.NouTube?.setMuted?.(${muted})`)?.catch?.(() => undefined)
  } catch {}
  if (hasPlayer && browsingShorts) {
    pausePlayer()
  }
}
