import { orderBy } from 'es-toolkit'
import type { Bookmark } from '@/states/bookmarks'

export const FEED_ITEMS_PER_CHANNEL_LIMIT = 50

export function limitFeedBookmarksPerChannel(
  bookmarks: Bookmark[],
  perChannelLimit = FEED_ITEMS_PER_CHANNEL_LIMIT,
): Bookmark[] {
  const counts = new Map<string, number>()

  return orderBy(bookmarks, ['created_at'], ['desc']).filter((bookmark) => {
    const channelId = bookmark.json.id || ''
    if (!channelId) {
      return true
    }

    const count = counts.get(channelId) || 0
    if (count >= perChannelLimit) {
      return false
    }

    counts.set(channelId, count + 1)
    return true
  })
}
