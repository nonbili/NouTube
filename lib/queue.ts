import { ui$ } from '@/states/ui'
import { getVideoId } from './page'
import { queue$ } from '@/states/queue'
import { use$ } from '@legendapp/state/react'

export function usePlayingQueueIndex() {
  const pageUrl = use$(ui$.pageUrl)
  const bookmarks = use$(queue$.bookmarks)

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
