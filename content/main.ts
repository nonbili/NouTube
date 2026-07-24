import { intercept } from './intercept'
import { installH264ify } from './h264ify'
import { installClickbaitThumbnails } from './clickbait'
import { injectCSS } from './css'
import { initNouTube } from './noutube'
import { initUserScripts } from './user-scripts'
import { handleMutations, handleVideoPlayer } from './player'
import { emit } from './utils'
import { handleDialogs } from './dialogs'
import { handleMenu } from './menu'
import { pinchToZoom } from './pinch'
import { enterMini, exitMini, getMiniCurrentTime, installMiniPlayerInterceptor } from './mini-player'
import { installBlocklistFilter } from './blocklist'
import { installDislikeCount } from './dislikes'
import { installCommentTranslateButtons } from './translate'
import { interceptClipboard } from './clipboard'
import { installWatchNavigation } from './watch-nav'

try {
  if ((window as any).NouTubePreferH264) {
    installH264ify()
  }

  const clickbaitTarget = (window as any).NouTubeClickbaitThumbnail
  if (clickbaitTarget && clickbaitTarget !== 'default') {
    installClickbaitThumbnails(clickbaitTarget)
  }

  window.NouTube = initNouTube()
  interceptClipboard()
  installWatchNavigation()

  if (!window.electron) {
    intercept()
    if (window.isAndroid && location.host === 'm.youtube.com') {
      installMiniPlayerInterceptor()
    }
  }

  ;(window.NouTube as any).enterMini = enterMini
  ;(window.NouTube as any).exitMini = exitMini
  ;(window.NouTube as any).getMiniCurrentTime = getMiniCurrentTime

  if (document.documentElement) {
    injectCSS()
    initUserScripts()
    emit('onload')
    initObserver()
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      injectCSS()
      initUserScripts()
      emit('onload')
      initObserver()
    })
  }

  setInterval(() => (window._lact = Date.now()), 20 * 60 * 1000)
} catch (e) {
  console.error('NouScript: ', e)
}

async function initObserver() {
  const player = document.querySelector('#movie_player')
  if (player) {
    handleVideoPlayer(player)
  }
  const observer = new MutationObserver((mutations) => {
    if (!player) {
      handleMutations(mutations)
    }
    handleDialogs()
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  handleMenu()
  installBlocklistFilter()
  installDislikeCount()
  installDoubleTapGestures()
  installCommentTranslateButtons()

  pinchToZoom()
}

function installDoubleTapGestures() {
  if (!window.isAndroid) {
    return
  }

  const root = window as Window & typeof globalThis & { __noutubeDoubleTapGesturesInit?: boolean }
  if (root.__noutubeDoubleTapGesturesInit) {
    return
  }
  root.__noutubeDoubleTapGesturesInit = true

  let lastTapAt = 0
  let lastTapX = 0
  let lastTapY = 0
  let multiTouchSequence = false

  const isIgnored = (target: Element) =>
    Boolean(
      target.closest(
        'input, textarea, select, button, a, video, audio, [contenteditable="true"], [role="button"]',
      ),
    )

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) multiTouchSequence = true
    },
    { passive: true, capture: true },
  )

  document.addEventListener(
    'touchend',
    (event) => {
      if (multiTouchSequence) {
        if (event.touches.length === 0) multiTouchSequence = false
        return
      }
      if (event.changedTouches.length !== 1) return
      const touch = event.changedTouches[0]
      const now = Date.now()
      const dx = touch.clientX - lastTapX
      const dy = touch.clientY - lastTapY
      const isDoubleTap = now - lastTapAt <= 300 && dx * dx + dy * dy <= 48 * 48

      lastTapAt = now
      lastTapX = touch.clientX
      lastTapY = touch.clientY

      if (!isDoubleTap) return
      lastTapAt = 0

      const eventTarget = event.target instanceof Element ? event.target : null
      const target = eventTarget || document.elementFromPoint(touch.clientX, touch.clientY)
      if (!target || isIgnored(target)) return
      const settings = window.NouTube?.getSettings?.()
      if (settings?.doubleTapToToggleHeader) {
        event.preventDefault()
        emit('header-double-tap')
      }
    },
    { passive: false, capture: true },
  )
}
