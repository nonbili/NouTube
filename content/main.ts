import { blockAds } from './ad'
import { injectCSS } from './css'
import { initNouTube } from './noutube'
import { handleVideoPlayer } from './player'
import { retry } from 'es-toolkit'
import { emit } from './utils'

window.NouTube = initNouTube()

try {
  blockAds()

  initObserver()

  setInterval(() => (window._lact = Date.now()), 20 * 60 * 1000)
} catch (e) {
  console.error('NouScript: ', e)
}

async function initObserver() {
  const target = await retry(
    async () => {
      if (!document.documentElement) {
        throw 'documentElement not ready'
      }
      return document.documentElement
    },
    { retries: 50, delay: 100 },
  )

  const observer = new MutationObserver((mutations) => {
    handleVideoPlayer(mutations)
  })
  observer.observe(target, {
    childList: true,
    subtree: true,
  })

  injectCSS()
}
