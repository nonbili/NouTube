import { injectCSS } from './css'

export function preload() {
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS()
  })
}
