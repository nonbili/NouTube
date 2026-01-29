import { retry, throttle } from 'es-toolkit'
import { emit, isYTMusic, nouPolicy, parseJson } from './utils'
import { hideLiveChat, showLiveChatButton } from './livechat'
import { originalLabels } from './audio'
import { getSkipSegments, isSponsorBlockEnabled, Segment } from './sponsorblock'

export let player: any
let curVideoId = ''
let skipSegments: { videoId: string; segments: Segment[] } = { videoId: '', segments: [] }

const keys = {
  playing: 'nou:playing',
}

function getVideoEl() {
  return document.querySelector('#movie_player video') as any
}

function isIosNativeWebView() {
  return Boolean((window as any).webkit?.messageHandlers?.NouTubeI)
}

function isVideoInPiP(video = getVideoEl()) {
  return Boolean(video && (video.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === video))
}

function isVideoFullscreen() {
  const video = getVideoEl()
  return Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement || video?.webkitDisplayingFullscreen)
}

function enterVideoFullscreen() {
  const video = getVideoEl()
  if (video?.webkitSupportsFullscreen && typeof video.webkitEnterFullscreen == 'function') {
    try {
      video.webkitEnterFullscreen()
      return
    } catch {}
  }
  ;(document.querySelector('#player-control-container .fullscreen-icon') as HTMLButtonElement | null)?.click()
}

function exitVideoFullscreen() {
  const video = getVideoEl()
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen()
    return
  }
  if ((document as any).webkitFullscreenElement && typeof (document as any).webkitExitFullscreen == 'function') {
    ;(document as any).webkitExitFullscreen()
    return
  }
  if (video?.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen == 'function') {
    video.webkitExitFullscreen()
  }
}

function syncVideoFullscreen() {
  if (document.location.pathname !== '/watch') {
    return
  }
  if (isVideoInPiP()) {
    return
  }

  const isLandscape = window.matchMedia('(orientation: landscape)').matches
  if (isLandscape) {
    if (!isVideoFullscreen() && Math.max(window.innerWidth, window.innerHeight) < 1000) {
      enterVideoFullscreen()
    }
  } else if (isVideoFullscreen()) {
    exitVideoFullscreen()
  }
}

export function prepareForBackground() {
  if (document.location.pathname !== '/watch') {
    return false
  }

  const video = getVideoEl()
  if (!video) {
    return false
  }
  if (isVideoInPiP(video)) {
    return true
  }

  if (typeof video.play === 'function') {
    video.play().catch(() => {})
  }

  if (typeof video.webkitSetPresentationMode === 'function') {
    try {
      if (video.webkitPresentationMode !== 'picture-in-picture') {
        video.webkitSetPresentationMode('picture-in-picture')
      }
      return true
    } catch {}
  }

  if (typeof video.requestPictureInPicture === 'function') {
    video.requestPictureInPicture().catch(() => {})
    return true
  }

  if (!isVideoFullscreen()) {
    enterVideoFullscreen()
    return true
  }

  return false
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
  const player = el
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
      const video = el.querySelector('video')
      if (video) {
        ;['play', 'pause', 'timeupdate'].forEach((evt) => {
          video.addEventListener(evt, notifyProgress)
        })
        video.addEventListener('play', syncVideoFullscreen)
        progressBinded = true
      }
    }
    if (state == 1) {
      syncVideoFullscreen()
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
        void renderNativeActionButtons()

        hideLiveChat()
        if (playabilityStatus?.liveStreamability) {
          showLiveChatButton(curVideoId)
        }
      }

      if (isSponsorBlockEnabled()) {
        skipSegments = await getSkipSegments(videoId)
      }
    }
  })
}

window.addEventListener('orientationchange', syncVideoFullscreen)
window.addEventListener('resize', syncVideoFullscreen)
screen.orientation?.addEventListener?.('change', syncVideoFullscreen)

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

async function renderNativeActionButtons() {
  if (document.location.pathname != '/watch' || isYTMusic) {
    return
  }

  const badgeRenderer = document.querySelector('ytm-slim-video-information-renderer ytm-badge-supported-renderer')
  const host = badgeRenderer || document.body
  if (!host) {
    return
  }

  let container = document.querySelector('div#_inks_native_actions')
  if (!container) {
    container = document.createElement('div')
    container.id = '_inks_native_actions'
    host.append(container)
  }
  if (container.parentElement !== host) {
    host.append(container)
  }
  container.setAttribute('data-floating', host === document.body ? 'true' : 'false')

  container.innerHTML = ''

  const audioBtn = document.createElement('div')
  audioBtn.id = '_inks_audio_btn'
  audioBtn.innerHTML = nouPolicy.createHTML(/* HTML */ `
    Play original audio 🦦
  `)
  audioBtn.onclick = (e) => {
    e.stopPropagation()
    player.pauseVideo()
    emit('embed', curVideoId)
  }
  container.append(audioBtn)

  if (isIosNativeWebView()) {
    const pipBtn = document.createElement('div')
    pipBtn.id = '_inks_pip_btn'
    pipBtn.textContent = 'Start PiP'
    pipBtn.onclick = (e) => {
      e.stopPropagation()
      prepareForBackground()
    }
    container.append(pipBtn)
  }
}

export function restoreLastPlaying() {
  const value = parseJson(localStorage.getItem(keys.playing), {})
  if (value.url) {
    document.location = value.url
  }
}
