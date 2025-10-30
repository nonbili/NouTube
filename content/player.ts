import { retry, throttle } from 'es-toolkit'
import { emit, isYTMusic, nouPolicy, parseJson } from './utils'
import { hideLiveChat, showLiveChatButton } from './livechat'
import { originalLabels } from './audio'
import { getSkipSegments, isSponsorBlockEnabled, Segment } from './sponsorblock'

export let player: any
let curVideoId = ''
let shouldSaveProgress = false
let restoredProgress = false
let skipSegments: { videoId: string; segments: Segment[] } = { videoId: '', segments: [] }

const keys = {
  videos: 'nou:videos:progress',
  videoProgress(id: string) {
    return `nou:progress:${id}`
  },
}

export function handleVideoPlayer(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes.values()) {
      const el = node as any
      if (el.id == 'movie_player') {
        player = el
        const saveProgress = throttle((currentTime) => {
          if (shouldSaveProgress && restoredProgress) {
            localStorage.setItem(keys.videoProgress(curVideoId), currentTime)
          }
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
              progressBinded = true
            }
          }

          const { title, author, thumbnail, lengthSeconds, videoId } = videoDetails
          if (curVideoId != videoId) {
            const thumb = thumbnail.thumbnails.at(-1)
            const duration = +lengthSeconds
            window.NouTubeI?.notify(title, author, duration, thumb?.url || '')
            curVideoId = videoId
            restoredProgress = false
            shouldSaveProgress = duration > 60 * 10
            if (shouldSaveProgress) {
              const lastProgress = localStorage.getItem(keys.videoProgress(curVideoId))
              if (lastProgress) {
                player.seekTo(lastProgress)
              }
              restoredProgress = true
              const watchProgress = parseJson(localStorage.getItem(keys.videos), [])
              watchProgress.push(curVideoId)
              if (watchProgress.length > 100) {
                const id = watchProgress.pop()
                localStorage.removeItem(keys.videoProgress(id))
              }
              localStorage.setItem(keys.videos, JSON.stringify(watchProgress))
            }

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
          }
        })
      }
    }
  }
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
