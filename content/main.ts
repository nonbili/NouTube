import { intercept } from './intercept'
import { injectCSS } from './css'
import { initNouTube } from './noutube'
import { handleMutations, handleVideoPlayer } from './player'
import { emit } from './utils'
import { handleDialogs } from './dialogs'
import { handleMenu } from './menu'
import { pinchToZoom } from './pinch'
import { enterMini, exitMini, getMiniCurrentTime, installMiniPlayerInterceptor } from './mini-player'

try {
  window.NouTube = initNouTube()

  if (!window.electron) {
    intercept()
    if (window.isAndroid) {
      installMiniPlayerInterceptor()
    }
  }

  ;(window.NouTube as any).enterMini = enterMini
  ;(window.NouTube as any).exitMini = exitMini
  ;(window.NouTube as any).getMiniCurrentTime = getMiniCurrentTime

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
