import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import type { Bookmark } from './bookmarks'
import { isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import { limitFeedBookmarksPerChannel } from '@/lib/feed-cache'

interface Feed {
  id: string
  fetchedAt: Date
}

interface Store {
  feeds: Feed[]
  bookmarks: Bookmark[]
  urls: () => Set<string>
  ensureFeed: (id: string) => void
  setFeeds: (ids: string[]) => void
  saveFeed: (feed: Feed) => void
  removeChannel: (channelId: string) => void
  toggleBookmark: (bookmark: Bookmark) => void
  importBookmarks: (bookmark: Bookmark[]) => void
}

export const feeds$ = observable<Store>({
  feeds: [],
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(feeds$.bookmarks.get().map((x) => x.url))
  },
  ensureFeed: (id) => {
    if (!id) {
      return
    }

    const feeds = feeds$.feeds.get()
    if (feeds.some((feed) => feed.id === id)) {
      return
    }

    feeds$.feeds.set(feeds.concat({ id, fetchedAt: new Date(0) }))
  },
  setFeeds: (ids) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    const feeds = feeds$.feeds.get().filter((x) => uniqueIds.includes(x.id))
    const feedIds = feeds.map((x) => x.id)
    const newFeeds = uniqueIds.filter((id) => !feedIds.includes(id)).map((id) => ({ id, fetchedAt: new Date(0) }))
    feeds$.feeds.set(feeds.concat(newFeeds))
  },
  saveFeed: (feed) => {
    const index = feeds$.feeds.findIndex((x) => x.id.get() === feed.id)
    if (index !== -1) {
      feeds$.feeds[index].set(feed)
    }
  },
  removeChannel: (channelId) => {
    feeds$.feeds.set(feeds$.feeds.get().filter((x) => x.id !== channelId))
    feeds$.bookmarks.set(feeds$.bookmarks.get().filter((x) => x.json.id !== channelId))
  },
  toggleBookmark: (bookmark) => {
    if (feeds$.urls.has(bookmark.url)) {
      const filtered = feeds$.bookmarks.get().filter((x) => x.url !== bookmark.url)
      feeds$.bookmarks.set(filtered)
    } else {
      feeds$.bookmarks.unshift(bookmark)
    }
  },
  importBookmarks: (bookmarks) => {
    if (!bookmarks.length) {
      return 0
    }
    const bookmarkUrls = feeds$.urls
    const xs = bookmarks.filter((x) => !bookmarkUrls.has(x.url))
    feeds$.bookmarks.set(limitFeedBookmarksPerChannel(feeds$.bookmarks.get().concat(xs)))
  },
})

if (isWeb) {
  syncObservable(feeds$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'feeds',
      },
    },
  })
} else {
  syncObservable(feeds$, {
    persist: {
      name: 'feeds',
      plugin: ObservablePersistMMKV,
    },
  })
}
