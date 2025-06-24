import { emit } from './utils'

export let player: any
let curVideoId = ''

export function handleVideoPlayer(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes.values()) {
      const el = node as any
      if (el.id == 'movie_player') {
        player = el
        function notifyProgress() {
          NouTubeI.notifyProgress(el.getPlayerState() == 1, el.getCurrentTime())
        }
        let progressBinded = false
        el.addEventListener('onStateChange', (state: number) => {
          const videoDetails = el.getPlayerResponse()?.videoDetails
          if (!videoDetails) {
            return
          }
          if (!progressBinded) {
            const video = el.querySelector('video')
            if (video) {
              ;['play', 'pause', 'timeupdate'].forEach((evt) => {
                video.addEventListener(evt, notifyProgress)
              })
            }
          }
          const { title, author, thumbnail, lengthSeconds, videoId } = videoDetails
          if (curVideoId != videoId) {
            const thumb = thumbnail.thumbnails.at(-1)
            NouTubeI.notify(title, author, +lengthSeconds, thumb?.url || '')
            curVideoId = videoId
          }
        })
      }
    }
  }
}
