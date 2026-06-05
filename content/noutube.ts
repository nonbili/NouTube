import {
  hideShorts,
  showShorts,
} from './css'
import { playDefaultAudio, restoreLastPlaying } from './player'
import { emit } from './utils'
import { createDefaultUserStylesSnapshot, type UserStylesSnapshot } from '../lib/user-styles'
import { createDefaultBlocklistSnapshot, type BlocklistSnapshot } from '../lib/blocklist'

export const noutubeSettingsEvent = 'noutube:settings'
export const noutubeUserStylesEvent = 'noutube:user-styles'
export const noutubeBlocklistEvent = 'noutube:blocklist'

let settings: Record<string, unknown> = {}
let userStyles = createDefaultUserStylesSnapshot()
let blocklist = createDefaultBlocklistSnapshot()

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

function getBlocklist() {
  return blocklist
}

function setBlocklist(next?: BlocklistSnapshot) {
  blocklist = next || createDefaultBlocklistSnapshot()
  window.dispatchEvent(new CustomEvent(noutubeBlocklistEvent, { detail: blocklist }))
  return blocklist
}

export function initNouTube() {
  if (window.NouTubeInitialSettings) {
    setSettings(window.NouTubeInitialSettings)
  }

  if (window.NouTubeBlocklist) {
    setBlocklist(window.NouTubeBlocklist)
  }

  return {
    getSettings,
    setSettings,
    getUserStyles,
    setUserStyles,
    getBlocklist,
    setBlocklist,
    shortsHidden: true,
    play: () => getPlayer()?.playVideo(),
    pause: () => getPlayer()?.pauseVideo(),
    prev: () => getPlayer()?.previousVideo(),
    next: () => getPlayer()?.nextVideo(),
    seekBy: (delta: number) => getPlayer()?.seekBy(delta),
    getPlaybackRate: () => getPlayer()?.getPlaybackRate?.(),
    setPlaybackRate: (rate: number) => getPlayer()?.setPlaybackRate?.(rate),
    getPlaybackQuality: () => getPlayer()?.getPlaybackQuality?.(),
    setPlaybackQuality: (quality: string) => {
      const p = getPlayer()
      if (p) {
        if (p.setPlaybackQualityRange) {
          p.setPlaybackQualityRange(quality, quality)
        } else if (p.setPlaybackQuality) {
          p.setPlaybackQuality(quality)
        }
      }
    },
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
