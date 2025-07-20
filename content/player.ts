import { throttle } from 'es-toolkit'
import { emit, parseJson } from './utils'

export let player: any
let curVideoId = ''
let shouldSaveProgress = false
let restoredProgress = false

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
          const currentTime = el.getCurrentTime()
          NouTubeI.notifyProgress(el.getPlayerState() == 1, currentTime)
          saveProgress(currentTime)
        }, 1000)
        let progressBinded = false
        el.addEventListener('onStateChange', (state: number) => {
          const videoDetails = el.getPlayerResponse()?.videoDetails
          if (!videoDetails) {
            return
          }
          if (state == 0) {
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
            NouTubeI.notify(title, author, duration, thumb?.url || '')
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
          }
        })
      }
    }
  }
}
