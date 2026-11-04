export interface PlayerProgress {
  url: string
  videoId: string
  title: string
  author: string
  thumbnail: string
  current: number
  duration: number
}

// Read from one player instance. During a transition YouTube can briefly
// expose the old response and the new URL; wait for their identities to agree.
export function readPlayerProgress(player: any, current: number): PlayerProgress | undefined {
  const { videoDetails } = player.getPlayerResponse?.() || {}
  const videoId = videoDetails?.videoId
  const url = player.getVideoUrl?.() || ''
  if (!videoId || !url || !Number.isFinite(current) || current < 0) return
  try {
    const parsed = new URL(url)
    const urlId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).at(-1)
    if (urlId !== videoId) return
  } catch {
    return
  }
  return {
    url,
    videoId,
    current,
    title: videoDetails.title || '',
    author: videoDetails.author || '',
    thumbnail: videoDetails.thumbnail?.thumbnails?.at(-1)?.url || '',
    duration: Number(videoDetails.lengthSeconds) || 0,
  }
}

export function bindPlayerMedia(options: {
  getMedia: () => HTMLVideoElement | null
  isCurrent: () => boolean
  onProgress: () => void
  onPlayState: () => void
  onRateChange: (video: HTMLVideoElement) => void
  cancelPending: () => void
}) {
  let media: HTMLVideoElement | null = null
  let unbind = () => {}
  let disposed = false

  return {
    sync() {
      if (disposed || !options.isCurrent()) return false
      const next = options.getMedia()
      if (next === media) return false
      unbind()
      options.cancelPending()
      media = next
      if (!next) return false
      const valid = () => !disposed && media === next && options.isCurrent() && options.getMedia() === next
      const onProgress = () => {
        if (valid()) options.onProgress()
      }
      const onPlayState = () => {
        if (!valid()) return
        options.onPlayState()
        options.onProgress()
      }
      const onRateChange = () => {
        if (valid()) options.onRateChange(next)
      }
      next.addEventListener('timeupdate', onProgress)
      next.addEventListener('play', onPlayState)
      next.addEventListener('pause', onPlayState)
      next.addEventListener('ratechange', onRateChange)
      unbind = () => {
        next.removeEventListener('timeupdate', onProgress)
        next.removeEventListener('play', onPlayState)
        next.removeEventListener('pause', onPlayState)
        next.removeEventListener('ratechange', onRateChange)
      }
      return true
    },
    dispose() {
      disposed = true
      unbind()
      media = null
      options.cancelPending()
    },
  }
}
