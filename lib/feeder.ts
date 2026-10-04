import { syncState, when } from '@legendapp/state'
import { bookmarks$, newBookmark, type Bookmark } from '@/states/bookmarks'
import { getPageType } from './page'
import { XMLParser } from 'fast-xml-parser'
import { mainClient } from './main-client'
import { feeds$ } from '@/states/feeds'
import { settings$ } from '@/states/settings'
import { fetchYouTubeChannelMetadata } from './youtube-channel'
import { getFeedNotificationVideos, getLatestFeedPublishedAt, type FeedNotificationUpdate } from './feed-notification-videos'
import { notifyFeedVideos } from './feed-notifications'

let isFeederRunning = false
const fetchingChannelIds = new Set<string>()
type FetchChannelResult = 'success' | 'skipped' | 'already-running' | 'not-found' | 'http-error' | 'error'
export type RefreshChannelFeedResult = Exclude<FetchChannelResult, 'skipped'>

export async function feederLoop() {
  if (isFeederRunning) return
  isFeederRunning = true

  try {
    await when([
      syncState(feeds$).isPersistLoaded,
      syncState(bookmarks$).isPersistLoaded,
      syncState(settings$).isPersistLoaded,
    ])
    if (!settings$.feedsEnabled.get()) {
      return
    }

    const bookmarks = bookmarks$.bookmarks.get()
    let channels = bookmarks.filter((x) => {
      const pageType = getPageType(x.url)
      return !x.json.deleted && pageType?.home === 'yt' && pageType.type === 'channel'
    })

    const duplicateChannelIds = getDuplicateChannelIds(channels)

    // Update metadata sequentially and limit to avoid heavy initial hit
    const channelsToUpdate = channels
      .filter((x) => !x.json.id || !x.json.thumbnail || (!!x.json.id && duplicateChannelIds.has(x.json.id)))
      .slice(0, 20)
    for (const channel of channelsToUpdate) {
      await updateChannelMetadata(channel)
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 200))
    }

    if (channelsToUpdate.length) {
      channels = bookmarks.filter((x) => {
        const pageType = getPageType(x.url)
        return !x.json.deleted && pageType?.home === 'yt' && pageType.type === 'channel'
      })
    }

    const channelIds = Array.from(new Set(channels.map((x) => x.json.id!).filter(Boolean)))
    feeds$.setFeeds(channelIds)

    // Fetch RSS feeds sequentially to avoid overwhelming the app
    let success = true
    const notifications: FeedNotificationUpdate[] = []
    for (const id of channelIds) {
      const result = await fetchChannel(id, { onNewVideos: (update) => notifications.push(update) })
      if (result === 'error' || result === 'http-error' || result === 'not-found') success = false
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 100))
    }
    try {
      await notifyFeedVideos(notifications)
    } catch (error) {
      console.error('Feed notification failed:', error)
    }
    return success
  } catch (e) {
    console.error('feederLoop failed:', e)
    return false
  } finally {
    isFeederRunning = false
  }
}

export async function refreshChannelFeed(bookmarkId: string): Promise<RefreshChannelFeedResult> {
  if (!bookmarkId) {
    return 'error'
  }

  await when([syncState(feeds$).isPersistLoaded])

  const bookmark = bookmarks$.bookmarks.get().find((x) => x.id === bookmarkId)
  if (!bookmark || bookmark.json.deleted) {
    return 'error'
  }

  const pageType = getPageType(bookmark.url)
  if (pageType?.home !== 'yt' || pageType.type !== 'channel') {
    return 'error'
  }

  if (!bookmark.json.id) {
    await updateChannelMetadata(bookmark)
  }

  if (!bookmark.json.id) {
    return 'error'
  }

  const previousChannelId = bookmark.json.id
  let result = await fetchChannel(previousChannelId, { force: true })

  if (result === 'not-found') {
    await updateChannelMetadata(bookmark)
    const refreshedBookmark = bookmarks$.bookmarks.get().find((x) => x.id === bookmarkId)
    const refreshedChannelId = refreshedBookmark?.json.id

    if (refreshedChannelId && refreshedChannelId !== previousChannelId) {
      result = await fetchChannel(refreshedChannelId, { force: true })
    }
  }

  return result === 'skipped' ? 'error' : result
}

async function updateChannelMetadata(bookmark: Bookmark) {
  try {
    const metadata = await fetchYouTubeChannelMetadata(bookmark.url)
    let updated = false

    if (metadata.id && bookmark.json.id !== metadata.id) {
      bookmark.json.id = metadata.id
      updated = true
    }

    if (metadata.thumbnail && bookmark.json.thumbnail !== metadata.thumbnail) {
      bookmark.json.thumbnail = metadata.thumbnail
      updated = true
    }

    if (metadata.title && bookmark.title !== metadata.title) {
      bookmark.title = metadata.title
      updated = true
    }

    if (updated) {
      bookmarks$.saveBookmark(bookmark)
    }
  } catch (e) {
    console.error(`Failed to update metadata for ${bookmark.url}:`, e)
  }
}

function getDuplicateChannelIds(channels: Bookmark[]) {
  const counts = new Map<string, number>()
  for (const channel of channels) {
    if (!channel.json.id) {
      continue
    }
    counts.set(channel.json.id, (counts.get(channel.json.id) || 0) + 1)
  }

  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([id]) => id))
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

const threshold = 2 * 3600 * 1000 // 2 hours

async function fetchChannel(
  id: string,
  { force = false, onNewVideos }: { force?: boolean; onNewVideos?: (update: FeedNotificationUpdate) => void } = {},
): Promise<FetchChannelResult> {
  if (!id) {
    return 'error'
  }

  feeds$.ensureFeed(id)

  const feed = feeds$.feeds.get().find((x) => x.id === id)
  if (!feed) {
    return 'error'
  }

  if (!force && Date.now() - new Date(feed.fetchedAt).valueOf() < threshold) {
    return 'skipped'
  }

  if (fetchingChannelIds.has(id)) {
    return 'already-running'
  }

  fetchingChannelIds.add(id)

  try {
    const response = await mainClient.fetchFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
    if (!response.ok) {
      console.warn(`Feed returned HTTP ${response.status} for channel: ${id}`)
      feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
      return response.status === 404 ? 'not-found' : 'http-error'
    }

    if (!response.body) {
      console.warn(`Empty feed for channel: ${id}`)
      feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
      return 'success'
    }

    const data = parser.parse(response.body)
    const entries = data?.feed?.entry
    if (!entries) {
      // Only a valid, empty feed establishes a baseline. An error response
      // or malformed XML must not make the next fetch alert for old uploads.
      if (!data?.feed) return 'error'
      feeds$.saveFeed({ ...feed, fetchedAt: new Date(), latestPublishedAt: feed.latestPublishedAt ?? new Date(0) })
      return 'success'
    }

    const entryArray = Array.isArray(entries) ? entries : [entries]
    const bookmarks = entryArray.map((x: any) =>
      newBookmark({
        title: x.title,
        url: x.link.href,
        created_at: new Date(x.published),
        updated_at: new Date(x.updated),
        json: {
          id,
        },
      }),
    )
    const newVideos = getFeedNotificationVideos(bookmarks, feed.latestPublishedAt, feeds$.urls(), settings$.hideShorts.get())
    feeds$.importBookmarks(bookmarks)
    feeds$.saveFeed({
      ...feed,
      fetchedAt: new Date(),
      latestPublishedAt: getLatestFeedPublishedAt(bookmarks, feed.latestPublishedAt),
    })
    if (newVideos.length) {
      const channel = bookmarks$.bookmarks.get().find((bookmark) => !bookmark.json.deleted && bookmark.json.id === id)
      onNewVideos?.({ channel: channel?.title || data.feed.title || 'YouTube', count: newVideos.length })
    }
    return 'success'
  } catch (e) {
    console.error(`Failed to fetch channel ${id}:`, e)
    // Still mark as fetched to avoid immediate retry
    feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
    return 'error'
  } finally {
    fetchingChannelIds.delete(id)
  }
}
