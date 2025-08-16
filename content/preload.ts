import { blockAds } from './ad'
import { injectCSS } from './css'

export function preload() {
  document.addEventListener('DOMContentLoaded', () => {
    blockAds()
    injectCSS()
  })
}
