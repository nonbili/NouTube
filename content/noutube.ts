import { preparePictureInPicture, setPictureInPicture, watchPictureInPictureVideo } from './picture-in-picture'
import {
  hideShorts,
  showShorts,
} from './css'
import { playDefaultAudio, restoreLastPlaying } from './player'
import { getPlayerFormats } from './player-formats'
import { navigateWatch } from './split-view'
import { emit, isYTMusic } from './utils'
import { createDefaultUserStylesSnapshot, type UserStylesSnapshot } from '../lib/user-styles'
import { createDefaultBlocklistSnapshot, type BlocklistSnapshot } from '../lib/blocklist'
import { getPlayingPlaylist, getPlaylistNeighborUrl, type PlaylistDirection } from '../lib/playlist-nav'

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
  window.addEventListener('paste', (e) => {
    /* Leave pastes into YouTube's search box, comment box etc. alone. */
    if (isEditable(e.target) || isEditable(document.activeElement)) {
      return
    }
    const text = e.clipboardData?.getData('text')
    if (text) {
      emit('paste', text)
    }
  })
}

function isEditable(target: any) {
  if (!target) {
    return false
  }
  const tag = target.tagName?.toUpperCase?.()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
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

// m.youtube.com keeps the playlist in the page rather than in the player, so
// the player's own next and previous would leave the playlist.
function skipInPlaylist(direction: PlaylistDirection) {
  if (isYTMusic) return false
  const player = getPlayer()
  // The playlist panel only exists while it is expanded, so read what the
  // page handed to the player instead.
  const videoId = player?.getVideoData?.()?.video_id
  const playlist = getPlayingPlaylist(player?.getWatchNextResponse?.(), videoId)
  if (!playlist) return false
  const url = getPlaylistNeighborUrl(playlist, direction, videoId)
  // At either end the playlist owns the press too. Falling back to the
  // player here starts a recommendation or jumps into unrelated history.
  if (url) navigateWatch(url)
  return true
}

function skipToPrevious() {
  if (skipInPlaylist('previous')) return
  const player = getPlayer()
  // YouTube restarts the current video instead of going back once it has
  // played a few seconds; rewinding first makes one press go back.
  player?.seekTo?.(0)
  player?.previousVideo()
}

function skipToNext() {
  if (skipInPlaylist('next')) return
  getPlayer()?.nextVideo()
}

// YouTube Music's own previous buttons follow the same restart rule.
function handlePreviousButtons() {
  document.addEventListener(
    'click',
    (e) => {
      const button = (e.target as HTMLElement).closest?.('.previous-button')
      if (!button?.closest('ytmusic-player-bar,ytmusic-player-controls')) return
      e.preventDefault()
      e.stopImmediatePropagation()
      skipToPrevious()
    },
    true,
  )
}

export function initNouTube() {
  if (window.NouTubeInitialSettings) {
    setSettings(window.NouTubeInitialSettings)
  }

  if (window.NouTubeBlocklist) {
    setBlocklist(window.NouTubeBlocklist)
  }

  if (window.NouTubeUserStyles) {
    setUserStyles(window.NouTubeUserStyles)
  }

  watchPictureInPictureVideo()
  if (isYTMusic) {
    handlePreviousButtons()
  }

  return {
    getSettings,
    setSettings,
    getUserStyles,
    setUserStyles,
    getBlocklist,
    setBlocklist,
    preparePictureInPicture,
    setPictureInPicture,
    shortsHidden: true,
    play: () => getPlayer()?.playVideo(),
    pause: () => getPlayer()?.pauseVideo(),
    prev: skipToPrevious,
    next: () => {
      if (window.NouTubeI) {
        // The page url stops naming the playing video once the user browses
        // away with the mini player, so prefer the player's own.
        const videoUrl = getPlayer()?.getVideoUrl?.() || ''
        emit('playback-next', { url: videoUrl.includes('v=') ? videoUrl : document.location.href })
      } else {
        skipToNext()
      }
    },
    // What next falls back to once the app found nothing left in the queue.
    skipToNext,
    seekBy: (delta: number) => getPlayer()?.seekBy(delta),
    seekTo: (seconds: number) => getPlayer()?.seekTo(seconds),
    getVideoUrl: () => getPlayer()?.getVideoUrl?.() || '',
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
    getPlayerFormats,
  }
}
