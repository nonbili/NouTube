const SWIPE_THRESHOLD_PX = 56
const PREVENT_SCROLL_THRESHOLD_PX = 4
const VERTICAL_DOMINANCE_RATIO = 1.2
const EDGE_MARGIN_PX = 24

const IGNORED_TARGET_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="slider"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '.ytPlayerProgressBarHost',
  '.ytChapteredProgressBarHost',
  '.ytp-progress-bar',
  '.ytp-progress-list',
  '.ytm-progress-bar',
  '.progress-bar-line',
  '.progress-bar-background',
  '.progress-bar',
  'ytm-engagement-panel-section-list-renderer',
  'ytm-bottom-sheet-renderer',
  'bottom-sheet-container',
  'tp-yt-paper-dialog',
  'ytm-confirm-dialog-renderer',
  '[role="dialog"]',
  '#shorts-player',
].join(', ')

const PLAYER_SELECTOR = '#player-container-id, #movie_player, ytm-player'

interface GestureState {
  startX: number
  startY: number
  startedFullscreen: boolean
  watchHref: string
  player: Element
  innerPlayer: Element | null
  fullscreenEl: Element | null
  cancelled: boolean
}

function getFullscreenElement(doc: Document): Element | null {
  return doc.fullscreenElement || (doc as unknown as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement || null
}

function isGesturesBlocked(doc: Document): boolean {
  if (doc.location?.hostname === 'music.youtube.com') return true
  if (doc.location?.pathname !== '/watch') return true
  if (doc.documentElement?.classList.contains('_nou_native_mini')) return true
  if (doc.getElementById('_nou_lock_overlay') || doc.getElementById('_nou_fs_panel')) return true
  return false
}

function enterFullscreen(doc: Document, win: Window, player: Element) {
  const intentAt = Date.now()
  win.NouTubeFsIntent = intentAt
  const host = (player.closest('#player-container-id') || player.closest('#movie_player') || player) as HTMLElement
  const fsButton = host.querySelector<HTMLButtonElement>('.fullscreen-icon, .ytp-fullscreen-button')
  if (fsButton && !fsButton.disabled) {
    fsButton.click()
    const stampedAt = win.NouTubeFsIntent
    setTimeout(() => {
      if (win.NouTubeFsIntent === stampedAt && !getFullscreenElement(doc)) {
        win.NouTubeFsIntent = 0
      }
    }, 500)
    return
  }
  if (!host.requestFullscreen) {
    if (win.NouTubeFsIntent === intentAt) {
      win.NouTubeFsIntent = 0
    }
    return
  }
  Promise.resolve(host.requestFullscreen()).catch(() => {
    if (win.NouTubeFsIntent === intentAt) {
      win.NouTubeFsIntent = 0
    }
  })
}

function exitFullscreen(doc: Document) {
  if (doc.fullscreenElement) {
    Promise.resolve(doc.exitFullscreen?.()).catch(() => {})
    return
  }
  const webkitDoc = doc as unknown as {
    webkitFullscreenElement?: Element | null
    webkitExitFullscreen?: () => unknown
  }
  if (webkitDoc.webkitFullscreenElement) {
    Promise.resolve(webkitDoc.webkitExitFullscreen?.()).catch(() => {})
  }
}

export function attachPlayerGestureListeners(doc: Document, win: Window) {
  let gesture: GestureState | null = null

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      if (gesture) gesture.cancelled = true
      return
    }
    if (isGesturesBlocked(doc)) {
      gesture = null
      return
    }

    const touch = event.touches[0]
    const rawTarget = event.target as { closest?: unknown; parentElement?: Element | null } | null
    const eventTarget =
      rawTarget && typeof rawTarget.closest === 'function'
        ? (rawTarget as Element)
        : (rawTarget?.parentElement ?? null)
    const target = eventTarget || doc.elementFromPoint?.(touch.clientX, touch.clientY)
    if (!target || target.closest(IGNORED_TARGET_SELECTOR)) {
      gesture = null
      return
    }

    const player = target.closest(PLAYER_SELECTOR)
    if (!player) {
      gesture = null
      return
    }

    const watchHref = doc.location?.href ?? ''
    const host = player.closest('#player-container-id') || player.closest('#movie_player') || player
    const innerPlayer = host.querySelector('#movie_player') ?? (host.id === 'movie_player' ? host : null)
    const fsEl = getFullscreenElement(doc)
    if (fsEl) {
      if (!fsEl.contains(target)) {
        gesture = null
        return
      }
      if (touch.clientY < EDGE_MARGIN_PX || touch.clientY > win.innerHeight - EDGE_MARGIN_PX) {
        gesture = null
        return
      }
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedFullscreen: true,
        watchHref,
        player,
        innerPlayer,
        fullscreenEl: fsEl,
        cancelled: false,
      }
      return
    }

    gesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      startedFullscreen: false,
      watchHref,
      player,
      innerPlayer,
      fullscreenEl: null,
      cancelled: false,
    }
  }

  const isGestureContextValid = (state: GestureState) =>
    !isGesturesBlocked(doc) &&
    (doc.location?.href ?? '') === state.watchHref &&
    state.player.isConnected &&
    (state.innerPlayer === null || state.innerPlayer.isConnected) &&
    getFullscreenElement(doc) === state.fullscreenEl

  const onTouchMove = (event: TouchEvent) => {
    if (!gesture || gesture.cancelled) return
    if (event.touches.length !== 1 || !isGestureContextValid(gesture)) {
      gesture.cancelled = true
      return
    }

    const touch = event.touches[0]
    const dx = touch.clientX - gesture.startX
    const dy = touch.clientY - gesture.startY

    const isVerticalUp = !gesture.startedFullscreen && dy < -PREVENT_SCROLL_THRESHOLD_PX
    const isVerticalDown = gesture.startedFullscreen && dy > PREVENT_SCROLL_THRESHOLD_PX
    if ((isVerticalUp || isVerticalDown) && Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE_RATIO) {
      if (event.cancelable) {
        event.preventDefault()
      }
    }
  }

  const onTouchEnd = (event: TouchEvent) => {
    const current = gesture
    gesture = null
    if (!current || current.cancelled || event.changedTouches.length !== 1) return
    if (!isGestureContextValid(current)) return

    const touch = event.changedTouches[0]
    const dx = touch.clientX - current.startX
    const dy = touch.clientY - current.startY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDy <= absDx * VERTICAL_DOMINANCE_RATIO) return

    if (!current.startedFullscreen && dy <= -SWIPE_THRESHOLD_PX) {
      enterFullscreen(doc, win, current.player)
    } else if (current.startedFullscreen && dy >= SWIPE_THRESHOLD_PX) {
      exitFullscreen(doc)
    }
  }

  const onTouchCancel = () => {
    gesture = null
  }

  doc.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  doc.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
  doc.addEventListener('touchend', onTouchEnd, { capture: true, passive: true })
  doc.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true })

  return () => {
    doc.removeEventListener('touchstart', onTouchStart, { capture: true })
    doc.removeEventListener('touchmove', onTouchMove, { capture: true })
    doc.removeEventListener('touchend', onTouchEnd, { capture: true })
    doc.removeEventListener('touchcancel', onTouchCancel, { capture: true })
  }
}

export function isPlayerGesturesSupported(win: Window, doc: Document): boolean {
  if (win.NouTubeIOS) {
    return Boolean(doc.fullscreenEnabled)
  }
  return Boolean(win.isAndroid)
}

export function installPlayerGestures() {
  if (!isPlayerGesturesSupported(window, document)) {
    return
  }

  const root = window as Window & typeof globalThis & { __noutubePlayerGesturesInit?: boolean }
  if (root.__noutubePlayerGesturesInit) {
    return
  }
  root.__noutubePlayerGesturesInit = true

  attachPlayerGestureListeners(document, window)
}
