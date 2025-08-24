import { hideShorts, showShorts } from './css'
import { playDefaultAudio } from './player'

const getPlayer = (): any => document.getElementById('movie_player')

export function initNouTube() {
  return {
    play: () => getPlayer()?.playVideo(),
    pause: () => getPlayer()?.pauseVideo(),
    prev: () => getPlayer()?.previousVideo(),
    next: () => getPlayer()?.nextVideo(),
    seekBy: (delta: number) => getPlayer()?.seekBy(delta),
    hideShorts,
    showShorts,
    playDefaultAudio,
  }
}
