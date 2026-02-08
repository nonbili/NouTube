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
