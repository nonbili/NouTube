import { history$ } from '@/states/history'

// Anything shorter is not worth resuming, and a video watched to (nearly) the
// end should start over instead.
const MIN_RESUME_SECONDS = 5
const END_MARGIN_SECONDS = 10

// lib/page's getVideoId would drag states/ui, and with it a states/tabs import
// cycle, into this module.
export function getVideoIdFromUrl(url: string) {
  try {
    return new URL(url).searchParams.get('v') || ''
  } catch {
    return ''
  }
}

export function withResumeTime(url: string, current: number) {
  try {
    const next = new URL(url)
    next.searchParams.set('t', `${Math.floor(current)}s`)
    return next.href
  } catch {
    return url
  }
}

/** The last played video with its position baked into the url, when resuming it makes sense. */
export function getLastPlaying() {
  const last = history$.bookmarks[0].get()
  if (!last?.videoId || !last.url) {
    return undefined
  }
  const current = Number(last.current) || 0
  const duration = Number(last.duration) || 0
  if (current < MIN_RESUME_SECONDS) {
    return undefined
  }
  if (duration > 0 && current > duration - END_MARGIN_SECONDS) {
    return undefined
  }
  return { videoId: last.videoId, url: withResumeTime(last.url, current), current }
}
