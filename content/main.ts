import { intercept } from './intercept'
import { injectCSS } from './css'
import { initNouTube } from './noutube'
import { handleMutations, handleVideoPlayer } from './player'
import { emit } from './utils'
import { handleDialogs } from './dialogs'
import { handleMenu } from './menu'
import { pinchToZoom } from './pinch'

function preventYoutubeBackgroundPause() {
  if (!window.webkit?.messageHandlers?.NouTubeI || !document.location.host.endsWith('youtube.com')) {
    return
  }

  const stopImmediate = (event: Event) => event.stopImmediatePropagation()
  for (const [key, value] of [
    ['hidden', false],
    ['webkitHidden', false],
    ['visibilityState', 'visible'],
  ] as const) {
    try {
      Object.defineProperty(document, key, {
        configurable: true,
        get: () => value,
      })
    } catch {}
  }

  document.addEventListener('visibilitychange', stopImmediate, true)
  window.addEventListener('pagehide', stopImmediate, true)
}

try {
  window.NouTube = initNouTube()
  preventYoutubeBackgroundPause()

  if (!window.electron) {
    intercept()
  }

  if (document.documentElement) {
    injectCSS()
    emit('onload')
    initObserver()
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      injectCSS()
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

  pinchToZoom()
}
