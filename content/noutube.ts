import { hideShorts, showShorts } from './css'
import { playDefaultAudio, restoreLastPlaying } from './player'
import { emit, log } from './utils'

const getPlayer = (): any => document.getElementById('movie_player')

let bridged = false
function bridgeShortcuts() {
  if (bridged) {
    return
  }
  bridged = true
  window.addEventListener('keyup', (e) => {
    emit('keyup', { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey })
  })
}

export function initNouTube() {
  return {
    shortsHidden: true,
    play: () => getPlayer()?.playVideo(),
    pause: () => getPlayer()?.pauseVideo(),
    prev: () => getPlayer()?.previousVideo(),
    next: () => getPlayer()?.nextVideo(),
    seekBy: (delta: number) => getPlayer()?.seekBy(delta),
    hideShorts() {
      hideShorts()
      this.shortsHidden = true
    },
    showShorts() {
      showShorts()
      this.shortsHidden = false
    },
    playDefaultAudio,
    restoreLastPlaying,
    bridgeShortcuts,
  }
}
