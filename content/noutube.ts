import {
  hideShorts,
  showShorts,
} from './css'
import { playDefaultAudio, restoreLastPlaying } from './player'
import { emit } from './utils'
import { createDefaultUserStylesSnapshot, type UserStylesSnapshot } from '../lib/user-styles'

export const noutubeSettingsEvent = 'noutube:settings'
export const noutubeUserStylesEvent = 'noutube:user-styles'

let settings = {}
let userStyles = createDefaultUserStylesSnapshot()

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

function getSettings() {
  return settings
}

function setSettings(next: Record<string, unknown> = {}) {
  settings = { ...settings, ...next }
  window.dispatchEvent(new CustomEvent(noutubeSettingsEvent, { detail: settings }))
  return settings
}

function getUserStyles() {
  return userStyles
}

function setUserStyles(next?: UserStylesSnapshot) {
  userStyles = next || createDefaultUserStylesSnapshot()
  window.dispatchEvent(new CustomEvent(noutubeUserStylesEvent, { detail: userStyles }))
  return userStyles
}

export function initNouTube() {
  return {
    getSettings,
    setSettings,
    getUserStyles,
    setUserStyles,
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
