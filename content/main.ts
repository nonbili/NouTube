import { blockAds } from './ad'
import { injectCSS } from './css'
import { initNouTube } from './noutube'
import { handleVideoPlayer } from './player'
import { emit } from './utils'
import { handleDialogs } from './dialogs'
import { handleMenu } from './menu'
import { preload } from './preload'

try {
  if (!window.electron) {
    preload()
  }
  if (window.electron) {
    blockAds()
  }
  window.NouTube = initNouTube()
  if (document.documentElement) {
    initObserver()
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      initObserver()
    })
  }

  setInterval(() => (window._lact = Date.now()), 20 * 60 * 1000)
} catch (e) {
  console.error('NouScript: ', e)
}

async function initObserver() {
  const observer = new MutationObserver((mutations) => {
    handleVideoPlayer(mutations)
    handleDialogs()
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  handleMenu()
}
