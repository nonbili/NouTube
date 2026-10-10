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
import {
  getHeldPlaylist,
  getPlayingPlaylist,
  getPlaylistNeighborUrl,
  isPlaylistCurrent,
  type PlaylistDirection,
} from '../lib/playlist-nav'

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
  const response = player?.getWatchNextResponse?.()
  // The player has no response yet right after a page load, while the one the
  // page was served with is already there.
  const playlist =
    getPlayingPlaylist(response, videoId) ||
    getHeldPlaylist(
      [response, (window as any).ytInitialData],
      videoId,
      new URLSearchParams(location.search).get('list'),
    )
  if (!playlist) return false
  const url = getPlaylistNeighborUrl(playlist, direction, videoId)
  // At either end the playlist owns the press too. Falling back to the
  // player here starts a recommendation or jumps into unrelated history.
  if (!url) return true
  if (isPlaylistCurrent(playlist, videoId)) {
    navigateWatch(url)
  } else {
    // The page stopped fetching playlists, and navigating inside it would
    // leave it that way. Loading the video afresh gets it going again.
    location.assign(url)
  }
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
  const button = pressedNextButton
  pressedNextButton = undefined
  if (button?.isConnected) {
    // The press came from the page and the queue had nothing for it, so it
    // goes back to the button it was taken from.
    passNextClick = true
    try {
      button.click()
    } finally {
      passNextClick = false
    }
    return
  }
  if (skipInPlaylist('next')) return
  getPlayer()?.nextVideo()
}

function next() {
  if (window.NouTubeI) {
    // The page url stops naming the playing video once the user browses
    // away with the mini player, so prefer the player's own.
    const videoUrl = getPlayer()?.getVideoUrl?.() || ''
    emit('playback-next', { url: videoUrl.includes('v=') ? videoUrl : document.location.href })
  } else {
    skipToNext()
  }
}

let pressedNextButton: HTMLElement | undefined
let passNextClick = false

// The next button of the mobile player shares its class with the previous
// one and has no label that survives a change of language, so it is told
// apart by coming last.
function getNextButton(target: EventTarget | null): HTMLElement | undefined {
  const button = (target as HTMLElement | null)?.closest?.<HTMLElement>('.player-middle-controls-prev-next-button')
  const buttons = button?.closest('.player-controls-middle')?.querySelectorAll('.player-middle-controls-prev-next-button')
  if (button && buttons && buttons.length > 1 && buttons[buttons.length - 1] == button) return button
}

// YouTube's own next button knows nothing of the app's queue, so the app gets
// to answer the press first, the same as for the next of the media controls.
function handleNextButtons() {
  document.addEventListener(
    'click',
    (e) => {
      if (passNextClick) return
      const button = getNextButton(e.target)
      if (!button || button.getAttribute('aria-disabled') == 'true') return
      e.preventDefault()
      e.stopImmediatePropagation()
      pressedNextButton = button
      // An answer that never comes must not send a later press to this button.
      setTimeout(() => {
        if (pressedNextButton == button) pressedNextButton = undefined
      }, 2000)
      next()
    },
    true,
  )
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
  } else if (window.NouTubeI) {
    handleNextButtons()
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
    next,
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
