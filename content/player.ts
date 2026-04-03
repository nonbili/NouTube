import { retry, throttle } from 'es-toolkit'
import { emit, log, isYTMusic, nouPolicy, parseJson } from './utils'
import { hideLiveChat, showLiveChatButton } from './livechat'
import { originalLabels } from './audio'
import { getSkipSegments, isSponsorBlockEnabled, Segment } from './sponsorblock'
import { playbackRates } from '../lib/playback-rate'

export let player: any
let curVideoId = ''
let skipSegments: { videoId: string; segments: Segment[] } = { videoId: '', segments: [] }

const keys = {
  playing: 'nou:playing',
  settings: 'nou:settings',
}

function getSettings() {
  return parseJson(localStorage.getItem(keys.settings), {}) as {
    playbackRate?: number
    sponsorBlock?: boolean
  }
}

function getSavedPlaybackRate() {
  const { playbackRate } = getSettings()
  return typeof playbackRate == 'number' && Number.isFinite(playbackRate) ? playbackRate : 1
}

function getVideoElement(player: any) {
  const video = document.querySelector('#movie_player video') || player?.querySelector?.('video') || document.querySelector('video')
  return video instanceof HTMLVideoElement ? video : null
}

function extendPlaybackRates(player: any) {
  if (!player || player.__nouPlaybackRatesExtended) {
    return
  }

  try {
    const originalGetRates = player.getAvailablePlaybackRates?.bind(player)
    const originalSetRate = player.setPlaybackRate?.bind(player)
    if (!originalGetRates || !originalSetRate) {
      return
    }

    player.getAvailablePlaybackRates = () => playbackRates
    player.setPlaybackRate = (rate: number) => {
      const video = getVideoElement(player)
      if (video) {
        video.playbackRate = rate
      }

      if (rate <= 2) {
        originalSetRate(rate)
      }

      emit('playback-rate', { playbackRate: rate })
    }
    player.__nouPlaybackRatesExtended = true
  } catch (e) {
    log('failed to extend playback rates', e)
  }
}

function applySavedPlaybackRate(player: any) {
  const playbackRate = getSavedPlaybackRate()
  try {
    const availableRates = player.getAvailablePlaybackRates?.()
    if (Array.isArray(availableRates) && !availableRates.includes(playbackRate)) {
      return
    }
    player.setPlaybackRate?.(playbackRate)
  } catch (e) {
    log('failed to apply playback rate', e)
  }
}

export function handleMutations(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes.values()) {
      const el = node as any
      if (el.id == 'movie_player') {
        handleVideoPlayer(el)
      }
    }
  }
}

export function handleVideoPlayer(el: any) {
  player = el
  extendPlaybackRates(player)
  let title = ''
  let duration = 0

  const saveProgress = throttle((currentTime) => {
    const url = player.getVideoUrl()
    localStorage.setItem(keys.playing, JSON.stringify({ url }))
    emit('progress', { url, title, videoId: curVideoId, current: currentTime, duration })
  }, 5000)
  const notifyProgress = throttle(() => {
    if (!el.getCurrentTime) {
      hideLiveChat()
      return
    }
    const currentTime = el.getCurrentTime()
    window.NouTubeI?.notifyProgress(el.getPlayerState() == 1, currentTime)
    saveProgress(currentTime)
    if (isSponsorBlockEnabled() && curVideoId == skipSegments.videoId && skipSegments.segments.length) {
      for (const segment of skipSegments.segments) {
        const [start, end] = segment.segment
        if (currentTime > start && currentTime < end) {
          player.seekTo(end)
          return
        }
      }
    }
  }, 1000)
  let progressBinded = false
  el.addEventListener('onStateChange', async (state: number) => {
    const { playabilityStatus, videoDetails } = el.getPlayerResponse() || {}
    if (!videoDetails) {
      hideLiveChat()
      return
    }
    if (state == 0 && !isYTMusic) {
      emit('playback-end')
    }
    if (document.location.host == 'm.youtube.com' && document.location.pathname == '/') {
      el.pauseVideo()
      return
    }
    if (!progressBinded) {
      const video = getVideoElement(player)
      if (video) {
        ;['play', 'pause', 'timeupdate'].forEach((evt) => {
          video.addEventListener(evt, notifyProgress)
        })
        video.addEventListener('ratechange', () => {
          emit('playback-rate', { playbackRate: video.playbackRate })
        })
        progressBinded = true
      }
    }

    const { title: _title, author, thumbnail, lengthSeconds, videoId } = videoDetails
    if (curVideoId != videoId) {
      player.unMute()
      const thumb = thumbnail.thumbnails.at(-1)
      duration = +lengthSeconds
      title = _title
      window.NouTubeI?.notify(title, author, duration, thumb?.url || '')
      curVideoId = videoId

      if (window.NouTubeI) {
        renderPlayOriginalAudioBtn()

        hideLiveChat()
        if (playabilityStatus?.liveStreamability) {
          showLiveChatButton(curVideoId)
        }
      }

      if (isSponsorBlockEnabled()) {
        skipSegments = await getSkipSegments(videoId)
      }

      applySavedPlaybackRate(player)
    }
  })
}

screen.orientation.addEventListener('change', (event) => {
  if (document.location.pathname != '/watch') {
    return
  }

  const target = event.target as any
  const type = target.type
  if (type.includes('landscape')) {
    if (!document.fullscreenElement && screen.availWidth < 1000) {
      ;(document.querySelector('#player-control-container .fullscreen-icon') as HTMLButtonElement)?.click()
    }
  } else {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }
})

export async function playDefaultAudio() {
  await retry(
    () => {
      if (!player) {
        throw 'player not ready'
      }
      return player
    },
    { retries: 30, delay: 100 },
  )
  player?.playVideo()
  const audioTracks: any[] = await retry(
    () => {
      const tracks = player.getAvailableAudioTracks()
      if (!tracks.length) {
        throw 'tracks not ready'
      }
      return tracks
    },
    { retries: 30, delay: 100 },
  )
  let options = ''
  let selected
  let i = 0
  for (const track of audioTracks) {
    for (let v of Object.values(track)) {
      const value = v as any
      if (value && typeof value == 'object' && 'isDefault' in value && value.name) {
        if (originalLabels.some((x) => value.name.includes(x))) {
          selected = i.toString()
          player.setAudioTrack(track)
        }
        options += `<option value="${i}">${value.name}</option>`
      }
    }
    i++
  }

  let container = document.querySelector('div#_inks_audio_picker')
  if (!container) {
    container = document.createElement('div')
    container.id = '_inks_audio_picker'
    document.body.append(container)
  }
  container.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <select>
      ${options}
    </select>
  `)
  const select = container.querySelector('select')
  if (select) {
    if (selected) {
      select.value = selected
    }
    select.onchange = (e) => {
      const i = (e.target as HTMLSelectElement).value
      if (i != null) {
        player.setAudioTrack(audioTracks[+i])
      }
    }
  }
}

async function renderPlayOriginalAudioBtn() {
  if (document.location.pathname != '/watch' || isYTMusic) {
    return
  }

  const badgeRenderer = await retry(
    async () => {
      const badgeRenderer = document.querySelector('ytm-slim-video-information-renderer ytm-badge-supported-renderer')
      if (!badgeRenderer) {
        throw 'badge not ready'
      }
      return badgeRenderer
    },
    { retries: 30, delay: 100 },
  )

  if (!badgeRenderer) {
    return
  }

  const container = document.createElement('div')
  container.id = '_inks_audio_btn'
  container.innerHTML = nouPolicy.createHTML(/* HTML */ `
    Play original audio 🦦
  `)
  container.onclick = (e) => {
    e.stopPropagation()
    player.pauseVideo()
    emit('embed', curVideoId)
  }

  badgeRenderer.append(container)
}

export function restoreLastPlaying() {
  const value = parseJson(localStorage.getItem(keys.playing), {})
  if (value.url) {
    document.location = value.url
  }
}
