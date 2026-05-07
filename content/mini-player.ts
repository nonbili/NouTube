const MINI_STYLE_ID = '_nou_mini_player_style'
const MINI_ROOT_ID = '_nou_mini_player'
const MINI_STAGE_ID = '_nou_mini_player_stage'
const MINI_CORNER_KEY = 'nou:mini-player-corner'
const MINI_MARGIN = 12
const MINI_DRAG_THRESHOLD = 8
const SETTINGS_KEY = 'nou:settings'

type MiniCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type MiniState = {
  watchUrl: string
  iframe: HTMLIFrameElement
  playing: boolean
  playButton: HTMLButtonElement
  currentTime: number
  lastProgressAt: number
}

let miniState: MiniState | null = null
let miniMessageListenerInstalled = false

function isWatch(href: string): boolean {
  try {
    return new URL(href, location.href).pathname.startsWith('/watch')
  } catch {
    return false
  }
}

function isMiniPlayerEnabled(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return settings.miniPlayer !== false
  } catch {
    return true
  }
}

function getCurrentTime(): number {
  const player = document.getElementById('movie_player') as any
  try {
    return Math.floor(player?.getCurrentTime?.() ?? 0)
  } catch {
    return 0
  }
}

function buildResumeWatchUrl(prevHref: string): string | null {
  if (!isWatch(prevHref)) return null
  const url = new URL(prevHref)
  const t = getCurrentTime()
  if (t > 0) url.searchParams.set('t', `${t}s`)
  url.searchParams.set('autoplay', '1')
  return url.href
}

function getVideoId(watchUrl: string): string | null {
  try {
    return new URL(watchUrl).searchParams.get('v')
  } catch {
    return null
  }
}

function getStartSeconds(watchUrl: string): number {
  try {
    const t = new URL(watchUrl).searchParams.get('t')
    if (!t) return 0
    const match = t.match(/^(\d+)(?:s)?$/)
    return match ? Number(match[1]) : 0
  } catch {
    return 0
  }
}

function buildWatchUrlWithTime(watchUrl: string, seconds: number): string {
  const url = new URL(watchUrl)
  if (seconds > 0) url.searchParams.set('t', `${Math.floor(seconds)}s`)
  url.searchParams.set('autoplay', '1')
  return url.href
}

function buildEmbedUrl(watchUrl: string): string | null {
  const videoId = getVideoId(watchUrl)
  if (!videoId) return null

  const url = new URL(`https://www.youtube.com/embed/${videoId}`)
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('playsinline', '1')
  url.searchParams.set('enablejsapi', '1')
  url.searchParams.set('origin', location.origin)
  const start = getStartSeconds(watchUrl)
  if (start > 0) url.searchParams.set('start', String(start))
  return url.href
}

function ensureMiniStyle() {
  if (document.getElementById(MINI_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = MINI_STYLE_ID
  style.textContent = `
    #${MINI_ROOT_ID} {
      position: fixed !important;
      right: 12px !important;
      bottom: 12px !important;
      width: min(58vw, 260px) !important;
      aspect-ratio: 16 / 9 !important;
      z-index: 2147483647 !important;
      overflow: hidden !important;
      border-radius: 8px !important;
      background: #000 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42) !important;
      touch-action: none !important;
    }
    #${MINI_STAGE_ID},
    #${MINI_STAGE_ID} iframe {
      width: 100% !important;
      height: 100% !important;
    }
    #${MINI_STAGE_ID} iframe {
      display: block !important;
      border: 0 !important;
      background: #000 !important;
      pointer-events: none !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_restore {
      position: absolute !important;
      z-index: 2 !important;
      inset: 32px 0 0 0 !important;
      border: 0 !important;
      padding: 0 !important;
      background: transparent !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play,
    #${MINI_ROOT_ID} ._nou_mini_close {
      position: absolute !important;
      top: 6px !important;
      z-index: 3 !important;
      width: 28px !important;
      height: 28px !important;
      border-radius: 999px !important;
      border: 0 !important;
      padding: 0 !important;
      background: rgba(0, 0, 0, 0.62) !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45) !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play {
      left: 6px !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_close {
      right: 6px !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play::before,
    #${MINI_ROOT_ID} ._nou_mini_play::after,
    #${MINI_ROOT_ID} ._nou_mini_close::before,
    #${MINI_ROOT_ID} ._nou_mini_close::after {
      content: '' !important;
      position: absolute !important;
      display: block !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play::before,
    #${MINI_ROOT_ID} ._nou_mini_play::after {
      top: 8px !important;
      width: 4px !important;
      height: 12px !important;
      border-radius: 1px !important;
      background: #fff !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play::before {
      left: 9px !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play::after {
      right: 9px !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play._nou_paused::before {
      top: 7px !important;
      left: 11px !important;
      width: 0 !important;
      height: 0 !important;
      border-top: 7px solid transparent !important;
      border-bottom: 7px solid transparent !important;
      border-left: 10px solid #fff !important;
      border-radius: 0 !important;
      background: transparent !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_play._nou_paused::after {
      display: none !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_close::before,
    #${MINI_ROOT_ID} ._nou_mini_close::after {
      top: 13px !important;
      left: 8px !important;
      width: 12px !important;
      height: 2px !important;
      border-radius: 1px !important;
      background: #fff !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_close::before {
      transform: rotate(45deg) !important;
    }
    #${MINI_ROOT_ID} ._nou_mini_close::after {
      transform: rotate(-45deg) !important;
    }
  `
  document.head.appendChild(style)
}

function getSavedCorner(): MiniCorner {
  const corner = localStorage.getItem(MINI_CORNER_KEY)
  if (corner === 'top-left' || corner === 'top-right' || corner === 'bottom-left' || corner === 'bottom-right') {
    return corner
  }
  return 'bottom-right'
}

function applyCorner(root: HTMLElement, corner: MiniCorner) {
  root.style.left = corner.endsWith('left') ? `${MINI_MARGIN}px` : 'auto'
  root.style.right = corner.endsWith('right') ? `${MINI_MARGIN}px` : 'auto'
  root.style.top = corner.startsWith('top') ? `${MINI_MARGIN}px` : 'auto'
  root.style.bottom = corner.startsWith('bottom') ? `${MINI_MARGIN}px` : 'auto'
}

function snapMiniToNearestCorner(root: HTMLElement) {
  const rect = root.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const corner: MiniCorner = `${centerY < window.innerHeight / 2 ? 'top' : 'bottom'}-${
    centerX < window.innerWidth / 2 ? 'left' : 'right'
  }` as MiniCorner
  localStorage.setItem(MINI_CORNER_KEY, corner)
  applyCorner(root, corner)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function installDragHandlers(root: HTMLElement) {
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0
  let dragged = false

  root.addEventListener('pointerdown', (event) => {
    const target = event.target as Element | null
    if (target?.closest('._nou_mini_close, ._nou_mini_play')) return

    const rect = root.getBoundingClientRect()
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    startLeft = rect.left
    startTop = rect.top
    dragged = false
    root.setPointerCapture(event.pointerId)
    event.preventDefault()
  })

  root.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return

    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (!dragged && Math.hypot(dx, dy) < MINI_DRAG_THRESHOLD) return

    dragged = true
    const rect = root.getBoundingClientRect()
    root.style.left = `${clamp(startLeft + dx, MINI_MARGIN, window.innerWidth - rect.width - MINI_MARGIN)}px`
    root.style.top = `${clamp(startTop + dy, MINI_MARGIN, window.innerHeight - rect.height - MINI_MARGIN)}px`
    root.style.right = 'auto'
    root.style.bottom = 'auto'
    event.preventDefault()
  })

  root.addEventListener('pointerup', (event) => {
    if (pointerId !== event.pointerId) return

    pointerId = null
    root.releasePointerCapture(event.pointerId)
    if (dragged) {
      snapMiniToNearestCorner(root)
    } else {
      restoreWatchPage()
    }
    event.preventDefault()
  })

  root.addEventListener('pointercancel', (event) => {
    if (pointerId !== event.pointerId) return

    pointerId = null
    root.releasePointerCapture(event.pointerId)
    if (dragged) snapMiniToNearestCorner(root)
  })
}

function destroyMini() {
  document.getElementById(MINI_ROOT_ID)?.remove()
  document.getElementById(MINI_STYLE_ID)?.remove()
  miniState = null
}

function getEstimatedMiniCurrentTime(): number {
  if (!miniState) return 0
  if (!miniState.playing) return miniState.currentTime
  const elapsed = (Date.now() - miniState.lastProgressAt) / 1000
  return miniState.currentTime + Math.max(0, elapsed)
}

function restoreWatchPage() {
  const watchUrl = miniState ? buildWatchUrlWithTime(miniState.watchUrl, getEstimatedMiniCurrentTime()) : null
  destroyMini()
  if (watchUrl) location.href = watchUrl
}

function pauseMainPlayer() {
  try {
    ;(document.getElementById('movie_player') as any)?.pauseVideo?.()
  } catch {}
}

function postMiniPlayerCommand(command: 'playVideo' | 'pauseVideo') {
  const iframe = miniState?.iframe
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*')
}

function setMiniPlaying(playing: boolean) {
  if (!miniState) return
  miniState.currentTime = getEstimatedMiniCurrentTime()
  miniState.lastProgressAt = Date.now()
  miniState.playing = playing
  miniState.playButton.classList.toggle('_nou_paused', !playing)
  miniState.playButton.setAttribute('aria-label', playing ? 'Pause mini player' : 'Play mini player')
}

function toggleMiniPlayback() {
  if (!miniState) return
  const playing = !miniState.playing
  postMiniPlayerCommand(playing ? 'playVideo' : 'pauseVideo')
  setMiniPlaying(playing)
}

function installMiniMessageListener() {
  if (miniMessageListenerInstalled) return
  miniMessageListenerInstalled = true

  window.addEventListener('message', (event) => {
    if (!miniState || event.source !== miniState.iframe.contentWindow) return

    let data: any
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch {
      return
    }

    const info = data?.info
    if (!info) return

    if (typeof info.currentTime === 'number' && Number.isFinite(info.currentTime)) {
      miniState.currentTime = info.currentTime
      miniState.lastProgressAt = Date.now()
    }

    if (info.playerState === 1) {
      setMiniPlaying(true)
    } else if (info.playerState === 2 || info.playerState === 0) {
      setMiniPlaying(false)
    }
  })
}

function enterMiniFromWatch(watchUrl: string) {
  if (!isMiniPlayerEnabled()) return

  const embedUrl = buildEmbedUrl(watchUrl)
  if (!embedUrl) return

  if (miniState) {
    miniState.watchUrl = watchUrl
    miniState.iframe.src = embedUrl
    miniState.currentTime = getStartSeconds(watchUrl)
    miniState.lastProgressAt = Date.now()
    setMiniPlaying(true)
    return
  }

  ensureMiniStyle()
  installMiniMessageListener()
  pauseMainPlayer()

  const root = document.createElement('div')
  root.id = MINI_ROOT_ID
  applyCorner(root, getSavedCorner())

  const stage = document.createElement('div')
  stage.id = MINI_STAGE_ID

  const iframe = document.createElement('iframe')
  iframe.src = embedUrl
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
  iframe.allowFullscreen = true
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  stage.appendChild(iframe)

  const restoreButton = document.createElement('button')
  restoreButton.className = '_nou_mini_restore'
  restoreButton.type = 'button'
  restoreButton.setAttribute('aria-label', 'Restore player')
  restoreButton.onclick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    restoreWatchPage()
  }

  const playButton = document.createElement('button')
  playButton.className = '_nou_mini_play'
  playButton.type = 'button'
  playButton.setAttribute('aria-label', 'Pause mini player')
  playButton.onclick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    toggleMiniPlayback()
  }

  const closeButton = document.createElement('button')
  closeButton.className = '_nou_mini_close'
  closeButton.type = 'button'
  closeButton.setAttribute('aria-label', 'Close mini player')
  closeButton.onclick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    destroyMini()
  }

  root.append(stage, restoreButton, playButton, closeButton)
  installDragHandlers(root)
  document.body.appendChild(root)
  miniState = { watchUrl, iframe, playing: true, playButton, currentTime: getStartSeconds(watchUrl), lastProgressAt: Date.now() }
}

function resolveHistoryUrl(url: unknown): string {
  if (url instanceof URL) return url.href
  if (typeof url != 'string') return location.href
  return new URL(url, location.href).href
}

export function installMiniPlayerInterceptor() {
  if ((window as any).__nouMiniPlayerInterceptorInstalled) return
  ;(window as any).__nouMiniPlayerInterceptorInstalled = true

  let lastHref = location.href

  const onMaybeLeaveWatch = (nextHref = location.href) => {
    const next = nextHref
    if (next === lastHref) return
    const prev = lastHref
    lastHref = next

    if (miniState && isWatch(next)) {
      destroyMini()
      return
    }

    if (!isWatch(prev) || isWatch(next)) return
    if (!isMiniPlayerEnabled()) {
      destroyMini()
      return
    }

    const watchUrl = buildResumeWatchUrl(prev)
    if (watchUrl) enterMiniFromWatch(watchUrl)
  }

  const wrap = (key: 'pushState' | 'replaceState') => {
    const orig = history[key]
    history[key] = function (this: History, ...args: any[]) {
      onMaybeLeaveWatch(resolveHistoryUrl(args[2]))
      const r = orig.apply(this, args as any)
      queueMicrotask(() => onMaybeLeaveWatch())
      return r
    } as any
  }

  wrap('pushState')
  wrap('replaceState')
  window.addEventListener('popstate', () => onMaybeLeaveWatch())
  window.addEventListener('hashchange', () => onMaybeLeaveWatch())
  window.addEventListener('yt-navigate-finish', () => onMaybeLeaveWatch())
  document.addEventListener('yt-navigate-finish', () => onMaybeLeaveWatch())
}

export function enterMini() {
  if (!isMiniPlayerEnabled()) return

  const watchUrl = buildResumeWatchUrl(location.href)
  if (watchUrl) enterMiniFromWatch(watchUrl)
}

export function exitMini() {
  destroyMini()
}

export function getMiniCurrentTime(): number {
  return miniState ? Math.floor(getEstimatedMiniCurrentTime()) : getCurrentTime()
}
