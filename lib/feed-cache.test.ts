import { describe, expect, it } from 'bun:test'
import type { Bookmark } from '@/states/bookmarks'
import { FEED_ITEMS_PER_CHANNEL_LIMIT, limitFeedBookmarksPerChannel } from './feed-cache'

function makeFeedVideo(channelId: string, index: number): Bookmark {
  const createdAt = new Date(Date.UTC(2026, 2, 18, 0, index, 0))

  return {
    id: `${channelId}-${index}`,
    url: `https://m.youtube.com/watch?v=${channelId}-${index}`,
    title: `${channelId} video ${index}`,
    created_at: createdAt,
    updated_at: createdAt,
    json: {
      id: channelId,
    },
  }
}

describe('limitFeedBookmarksPerChannel', () => {
  it('caps each channel independently', () => {
    const bookmarks = [
      ...Array.from({ length: FEED_ITEMS_PER_CHANNEL_LIMIT + 3 }, (_, index) => makeFeedVideo('channel-a', index)),
      makeFeedVideo('channel-b', 0),
    ]

    const limited = limitFeedBookmarksPerChannel(bookmarks)
    const channelAItems = limited.filter((bookmark) => bookmark.json.id === 'channel-a')
    const channelBItems = limited.filter((bookmark) => bookmark.json.id === 'channel-b')

    expect(channelAItems).toHaveLength(FEED_ITEMS_PER_CHANNEL_LIMIT)
    expect(channelBItems).toHaveLength(1)
  })

  it('keeps the newest items for each channel', () => {
    const bookmarks = [
      makeFeedVideo('channel-a', 0),
      makeFeedVideo('channel-a', 1),
      makeFeedVideo('channel-a', 2),
    ]

    const limited = limitFeedBookmarksPerChannel(bookmarks, 2)

    expect(limited.map((bookmark) => bookmark.id)).toEqual(['channel-a-2', 'channel-a-1'])
  })
})
