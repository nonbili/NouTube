import { hideShorts, showShorts } from './css'
import { playDefaultAudio, player } from './player'

export function initNouTube() {
  return {
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    prev: () => player.previousVideo(),
    next: () => player.nextVideo(),
    seekBy: (delta: number) => player.seekBy(delta),
    hideShorts,
    showShorts,
    playDefaultAudio,
  }
}
