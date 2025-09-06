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

export async function feederLoop() {
  await when([syncState(feeds$).isPersistLoaded])
  if (!settings$.feedsEnabled.get()) {
    return
  }

  const bookmarks = bookmarks$.bookmarks.get()
  let channels = bookmarks.filter((x) => {
    const pageType = getPageType(x.url)
    return !x.json.deleted && pageType?.home == 'yt' && pageType.type == 'channel'
  })
  const channelsWithoutId = channels.filter((x) => !x.json.id)
  await Promise.all(channelsWithoutId.map((x) => getChannelId(x)))
  if (channelsWithoutId.length) {
    channels = bookmarks.filter((x) => {
      const pageType = getPageType(x.url)
      return !x.json.deleted && pageType?.home == 'yt' && pageType.type == 'channel'
    })
  }
  const channelIds = channels.map((x) => x.json.id!)
  feeds$.setFeeds(channelIds)
  await Promise.all(channelIds.map((id) => fetchChannel(id)))
}

async function getChannelId(bookmark: Bookmark) {
  const html = await mainClient.fetchFeed(bookmark.url)
  const $ = cheerio.load(html)
  const feedUrl = $('link[type="application/rss+xml"]').attr('href')
  if (feedUrl) {
    const id = new URL(feedUrl).searchParams.get('channel_id')
    if (id) {
      bookmark.json.id = id
      bookmarks$.saveBookmark(bookmark)
    }
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

const threshold = 2 * 3600 * 1000 // 2 hours

async function fetchChannel(id: string) {
  const feed = feeds$.feeds.get().find((x) => x.id == id)
  if (!feed || Date.now() - feed.fetchedAt.valueOf() < threshold) {
    return
  }
  const xml = await mainClient.fetchFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
  const data = parser.parse(xml)
  const bookmarks = data.feed.entry.map((x: any) =>
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
}
