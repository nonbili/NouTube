import { ui$ } from '@/states/ui'
import { getVideoId } from './page'
import { queue$ } from '@/states/queue'
import { useValue } from '@legendapp/state/react'

export function usePlayingQueueIndex() {
  const pageUrl = useValue(ui$.pageUrl)
  const bookmarks = useValue(queue$.bookmarks)

  let playingIndex = -1
  const videoId = getVideoId(pageUrl)
  if (videoId) {
    playingIndex = bookmarks.findIndex((x) => getVideoId(x.url) == videoId)
  }
  return {
    playingIndex,
    size: bookmarks.length,
  }
}

/**
 * The queue url to play after `pageUrl` finished, or undefined when the queue
 * has nothing left to play.
 *
 * When the finished video is part of the queue the next entry follows it. When
 * it is some unrelated video the queue picks up where it was left off instead
 * of restarting from the top: the last queue video that was opened, or the
 * entry after it when that one already played to the end.
 */
export function getNextQueueUrl(pageUrl: string): string | undefined {
  const bookmarks = queue$.bookmarks.get()
  const videoId = getVideoId(pageUrl)
  if (!videoId || !bookmarks.length) return

  const index = bookmarks.findIndex((x) => getVideoId(x.url) == videoId)
  if (index >= 0) {
    return bookmarks[index + 1]?.url
  }

  const lastPlayedId = getVideoId(queue$.lastPlayedUrl.get())
  const lastPlayedIndex = lastPlayedId ? bookmarks.findIndex((x) => getVideoId(x.url) == lastPlayedId) : -1
  if (lastPlayedIndex < 0) {
    // Nothing from the queue was played yet, so start at the top.
    return bookmarks[0].url
  }
  return queue$.lastPlayedEnded.get() ? bookmarks[lastPlayedIndex + 1]?.url : bookmarks[lastPlayedIndex].url
}

// The video the page url pointed at last, so that url tweaks YouTube makes
// while a video plays (a timestamp, tracking params) are not mistaken for
// opening that video again.
let lastTrackedVideoId = ''

/** Remembers a queue video as the resume point when the page opens one. */
export function trackQueuePlaying(pageUrl: string) {
  const videoId = getVideoId(pageUrl) || ''
  if (videoId == lastTrackedVideoId) return
  lastTrackedVideoId = videoId
  if (!videoId) return
  const bookmark = queue$.bookmarks.get().find((x) => getVideoId(x.url) == videoId)
  if (bookmark) {
    // Opening it again means it is unfinished, even if it played to the end before.
    queue$.markPlaying(bookmark.url)
  }
}

/** Remembers that a queue video played to the end. */
export function trackQueueEnded(pageUrl: string) {
  const videoId = getVideoId(pageUrl)
  if (!videoId) return
  const bookmark = queue$.bookmarks.get().find((x) => getVideoId(x.url) == videoId)
  if (bookmark) {
    queue$.markEnded(bookmark.url)
  }
}
