import { batch, observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import type { Bookmark } from './bookmarks'
import { isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import { orderBy, sortBy } from 'es-toolkit'

const LIMIT = 1000

interface Feed {
  id: string
  fetchedAt: Date
}

interface Store {
  feeds: Feed[]
  bookmarks: Bookmark[]
  urls: () => Set<string>
  setFeeds: (ids: string[]) => void
  saveFeed: (feed: Feed) => void
  toggleBookmark: (bookmark: Bookmark) => void
  importBookmarks: (bookmark: Bookmark[]) => void
}

export const feeds$ = observable<Store>({
  feeds: [],
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(feeds$.bookmarks.get().map((x) => x.url))
  },
  setFeeds: (ids) => {
    const feeds = feeds$.feeds.get().filter((x) => ids.includes(x.id))
    const feedIds = feeds.map((x) => x.id)
    const newFeeds = ids.filter((id) => !feedIds.includes(id)).map((id) => ({ id, fetchedAt: new Date(0) }))
    feeds$.feeds.set(feeds.concat(newFeeds))
  },
  saveFeed: (feed) => {
    const index = feeds$.feeds.findIndex((x) => x.id.get() == feed.id)
    if (index != -1) {
      feeds$.feeds[index].set(feed)
    }
  },
  toggleBookmark: (bookmark) => {
    if (feeds$.urls.has(bookmark.url)) {
      const filtered = feeds$.bookmarks.get().filter((x) => x.url != bookmark.url)
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
    feeds$.bookmarks.unshift(...xs)
    feeds$.bookmarks.set(orderBy(feeds$.bookmarks.get(), ['created_at'], ['desc']))
    if (feeds$.bookmarks.length > LIMIT) {
      feeds$.bookmarks.splice(LIMIT, feeds$.bookmarks.length)
    }
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
