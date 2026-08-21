import { retry, throttle } from 'es-toolkit'
import { emit, log, isYTMusic, nouPolicy, parseJson } from './utils'
import { hideLiveChat, showLiveChatButton } from './livechat'
import { originalLabels } from './audio'
import { clearSkipSegments, getSkipSegments, isSponsorBlockEnabled, renderSkipSegments, Segment } from './sponsorblock'
import { playbackRates } from '../lib/playback-rate'
import { applyCaptionFontScale } from './captions'

export let player: any
let curVideoId = ''
let skipSegments: { videoId: string; segments: Segment[] } = { videoId: '', segments: [] }
let segmentsResizeBinded = false
const fullscreenTitleId = '_nou_fullscreen_title'

const keys = {
  playing: 'nou:playing',
  settings: 'nou:settings',
}

function getSettings() {
  return parseJson(localStorage.getItem(keys.settings), {}) as {
    playbackRate?: number
    playbackQuality?: string
    sponsorBlock?: boolean
  }
}

function getSavedPlaybackRate() {
  const { playbackRate } = getSettings()
  return typeof playbackRate == 'number' && Number.isFinite(playbackRate) ? playbackRate : 1
}

function getSavedPlaybackQuality() {
  const { playbackQuality } = getSettings()
  return typeof playbackQuality == 'string' ? playbackQuality : 'auto'
}

function getVideoElement(player: any) {
  const video = document.querySelector('#movie_player video') || player?.querySelector?.('video') || document.querySelector('video')
  return video instanceof HTMLVideoElement ? video : null
}

function renderFullscreenTitle(title: string) {
  if (!window.isAndroid) {
    return
  }

  const controls = document.querySelector('#player-control-overlay .player-controls-content')
  if (!controls) {
    return
  }

  // Newer YouTube has its own fullscreen title; css.ts unhides that one instead.
  if (controls.querySelector('player-fullscreen-top-controls')) {
    return
  }

  let titleElement = controls.querySelector<HTMLElement>(`#${fullscreenTitleId}`)
  if (!titleElement) {
    titleElement = document.createElement('div')
    titleElement.id = fullscreenTitleId
    controls.append(titleElement)
  }
  titleElement.textContent = title
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

function extendPlaybackQuality(player: any) {
  if (!player || player.__nouPlaybackQualityExtended) {
    return
  }

  try {
    const originalSetQuality = player.setPlaybackQuality?.bind(player)
    const originalSetQualityRange = player.setPlaybackQualityRange?.bind(player)

    if (originalSetQuality) {
      player.setPlaybackQuality = (quality: string) => {
        originalSetQuality(quality)
        emit('playback-quality', { playbackQuality: quality })
      }
    }

    if (originalSetQualityRange) {
      player.setPlaybackQualityRange = (suggested: string, accepted: string) => {
        originalSetQualityRange(suggested, accepted)
        emit('playback-quality', { playbackQuality: suggested })
      }
    }

    player.__nouPlaybackQualityExtended = true
  } catch (e) {
    log('failed to extend playback quality', e)
  }
}

function applySavedPlaybackQuality(player: any) {
  const playbackQuality = getSavedPlaybackQuality()
  try {
    const availableQualities = player.getAvailableQualityLevels?.()
    if (playbackQuality === 'auto') {
      return
    }
    if (Array.isArray(availableQualities) && !availableQualities.includes(playbackQuality)) {
      // Let player fall back natively
    }
    if (player.setPlaybackQualityRange) {
      player.setPlaybackQualityRange(playbackQuality, playbackQuality)
    } else if (player.setPlaybackQuality) {
      player.setPlaybackQuality(playbackQuality)
    }
  } catch (e) {
    log('failed to apply playback quality', e)
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

function enforceMusicAudioMode(player: any) {
  if (!player || !isYTMusic) return
  try {
    if (typeof player.setMusicVideoType === 'function') {
      player.setMusicVideoType('MUSIC_VIDEO_TYPE_ATV')
    } else if (typeof player.setAudioOnly === 'function') {
      player.setAudioOnly(true)
    }
  } catch (e) {
    log('failed to enforce music audio mode', e)
  }
}

export function handleVideoPlayer(el: any) {
  player = el
  extendPlaybackRates(player)
  extendPlaybackQuality(player)
  enforceMusicAudioMode(player)
  // onApiChange fires when the player's modules (captions included) load, which
  // is the earliest point setOption('captions', ...) is accepted.
  el.addEventListener('onApiChange', () => {
    applyCaptionFontScale(el)
    enforceMusicAudioMode(el)
  })
  applyCaptionFontScale(el)
  let title = ''
  let duration = 0

  const saveProgress = throttle((currentTime) => {
    const url = player.getVideoUrl()
    localStorage.setItem(keys.playing, JSON.stringify({ url, current: currentTime }))
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
      renderSkipSegments(curVideoId, skipSegments.segments, duration || el.getDuration?.() || 0)
      for (const segment of skipSegments.segments) {
        const [start, end] = segment.segment
        if (currentTime > start && currentTime < end) {
          player.seekTo(end)
          return
        }
      }
    } else {
      clearSkipSegments()
    }
  }, 1000)

  // Entering fullscreen or rotating resizes the progress bar, and the redraw
  // above only rides on playback ticks, so a paused video would keep segments
  // drawn at the old width.
  const redrawSegments = () => {
    if (isSponsorBlockEnabled() && curVideoId == skipSegments.videoId && skipSegments.segments.length) {
      renderSkipSegments(curVideoId, skipSegments.segments, duration || el.getDuration?.() || 0)
    }
  }
  if (!segmentsResizeBinded) {
    segmentsResizeBinded = true
    window.addEventListener('resize', redrawSegments)
    document.addEventListener('fullscreenchange', () => {
      redrawSegments()
      // The fullscreen transition animates, so catch the settled layout too.
      setTimeout(redrawSegments, 400)
    })
  }

  let progressBinded = false
  el.addEventListener('onStateChange', async (state: number) => {
    const { playabilityStatus, videoDetails } = el.getPlayerResponse() || {}
    if (!videoDetails) {
      hideLiveChat()
      return
    }
    enforceMusicAudioMode(el)
    if (state == 0 && !isYTMusic) {
      localStorage.removeItem(keys.playing)
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
    renderFullscreenTitle(_title)
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

      clearSkipSegments()
      skipSegments = { videoId: '', segments: [] }
      if (isSponsorBlockEnabled()) {
        const nextSkipSegments = await getSkipSegments(videoId)
        // A previous request may finish after the user has navigated to a new
        // video. Never let that stale response replace or paint the new video.
        if (curVideoId !== videoId) {
          return
        }
        skipSegments = nextSkipSegments
        renderSkipSegments(videoId, nextSkipSegments.segments, duration)
      }

      applySavedPlaybackRate(player)
      applySavedPlaybackQuality(player)
    }
  })
}

screen.orientation.addEventListener('change', (event) => {
  if (document.location.pathname != '/watch' || document.visibilityState != 'visible') {
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

  let container = document.querySelector('div#_nou_audio_picker')
  if (!container) {
    container = document.createElement('div')
    container.id = '_nou_audio_picker'
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
  container.id = '_nou_audio_btn'
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

const MIN_RESUME_SECONDS = 5

function getVideoIdOf(url: string) {
  try {
    return new URL(url, document.location.href).searchParams.get('v') || ''
  } catch {
    return ''
  }
}

function hasTimeParam(url: string) {
  try {
    return new URL(url, document.location.href).searchParams.has('t')
  } catch {
    return false
  }
}

async function seekToSavedPosition(current: number) {
  try {
    const el: any = await retry(
      async () => {
        const el = document.getElementById('movie_player') as any
        if (!el?.seekTo) {
          throw 'player not ready'
        }
        return el
      },
      { retries: 30, delay: 100 },
    )
    el?.seekTo(current)
  } catch (e) {
    log('failed to seek to the saved position', e)
  }
}

export function restoreLastPlaying() {
  const value = parseJson(localStorage.getItem(keys.playing), {}) as { url?: string; current?: number }
  if (!value.url) {
    return
  }
  const current = Number(value.current) || 0
  const savedVideoId = getVideoIdOf(value.url)

  // The app can already open on the saved video with the position in the url.
  // Navigating again would reload the page and restart it from 0.
  if (savedVideoId && savedVideoId == getVideoIdOf(document.location.href)) {
    if (current >= MIN_RESUME_SECONDS && !hasTimeParam(document.location.href)) {
      void seekToSavedPosition(current)
    }
    return
  }

  document.location.href =
    current >= MIN_RESUME_SECONDS && !hasTimeParam(value.url) ? withTime(value.url, current) : value.url
}

function withTime(url: string, current: number) {
  try {
    const next = new URL(url, document.location.href)
    next.searchParams.set('t', `${Math.floor(current)}s`)
    return next.href
  } catch {
    return url
  }
}
