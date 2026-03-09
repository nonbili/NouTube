import { syncState, when } from '@legendapp/state'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { getPageType } from './page'
import { XMLParser } from 'fast-xml-parser'
import { mainClient } from '../desktop/src/renderer/ipc/main'
import { normalizeUrl } from './url'
import { feeds$ } from '@/states/feeds'
import { Bookmark } from '@/states/bookmarks'
import * as cheerio from 'cheerio/slim'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'

let isFeederRunning = false

export async function feederLoop() {
  if (isFeederRunning) return
  isFeederRunning = true

  try {
    await when([syncState(feeds$).isPersistLoaded])
    if (!settings$.feedsEnabled.get()) {
      return
    }

    const bookmarks = bookmarks$.bookmarks.get()
    let channels = bookmarks.filter((x) => {
      const pageType = getPageType(x.url)
      return !x.json.deleted && pageType?.home == 'yt' && pageType.type == 'channel'
    })

    // Update metadata sequentially and limit to avoid heavy initial hit
    const channelsToUpdate = channels.filter((x) => !x.json.id || !x.json.thumbnail).slice(0, 20)
    for (const channel of channelsToUpdate) {
      await updateChannelMetadata(channel)
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 200))
    }

    if (channelsToUpdate.length) {
      channels = bookmarks.filter((x) => {
        const pageType = getPageType(x.url)
        return !x.json.deleted && pageType?.home == 'yt' && pageType.type == 'channel'
      })
    }

    const channelIds = channels.map((x) => x.json.id!).filter(Boolean)
    feeds$.setFeeds(channelIds)

    // Fetch RSS feeds sequentially to avoid overwhelming the app
    for (const id of channelIds) {
      await fetchChannel(id)
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 100))
    }
  } catch (e) {
    console.error('feederLoop failed:', e)
  } finally {
    isFeederRunning = false
  }
}

async function updateChannelMetadata(bookmark: Bookmark) {
  try {
    const html = await mainClient.fetchFeed(bookmark.url)
    const $ = cheerio.load(html)
    
    let updated = false
    
    // Get channel ID from RSS link
    const feedUrl = $('link[type="application/rss+xml"]').attr('href')
    if (feedUrl) {
      const id = new URL(feedUrl).searchParams.get('channel_id')
      if (id && bookmark.json.id !== id) {
        bookmark.json.id = id
        updated = true
      }
    }
    
    // Get thumbnail from OG tags
    const thumbnail = $('meta[property="og:image"]').attr('content') || $('meta[property="og:thumbnail"]').attr('content')
    if (thumbnail && bookmark.json.thumbnail !== thumbnail) {
      bookmark.json.thumbnail = thumbnail
      updated = true
    }
    
    if (updated) {
      bookmarks$.saveBookmark(bookmark)
    }
  } catch (e) {
    console.error(`Failed to update metadata for ${bookmark.url}:`, e)
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

const threshold = 2 * 3600 * 1000 // 2 hours

async function fetchChannel(id: string) {
  if (!id) {
    return
  }
  const feed = feeds$.feeds.get().find((x) => x.id == id)
  if (!feed || Date.now() - feed.fetchedAt.valueOf() < threshold) {
    return
  }
  try {
    const xml = await mainClient.fetchFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
    if (!xml) {
      console.warn(`Empty feed for channel: ${id}`)
      feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
      return
    }

    const data = parser.parse(xml)
    const entries = data?.feed?.entry
    if (!entries) {
      // Not necessarily an error, could be a new channel or just failed to parse/fetch
      feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
      return
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
    feeds$.importBookmarks(bookmarks)
    feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
  } catch (e) {
    console.error(`Failed to fetch channel ${id}:`, e)
    // Still mark as fetched to avoid immediate retry
    feeds$.saveFeed({ ...feed, fetchedAt: new Date() })
  }
}
