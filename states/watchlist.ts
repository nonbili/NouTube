import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'

export interface Bookmark {
  url: string
  title: string
  thumbnail?: string
}

interface Store {
  bookmarks: Bookmark[]
  urls: () => Set<string>
  toggleBookmark: (bookmark: Bookmark) => void
  addBookmark: (bookmark: Bookmark) => void
  importBookmarks: (bookmarks: Bookmark[]) => void
}

export const watchlist$ = observable<Store>({
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(watchlist$.bookmarks.get().map((x) => x.url))
  },
  toggleBookmark: (bookmark) => {
    if (watchlist$.urls.has(bookmark.url)) {
      const filtered = watchlist$.bookmarks.get().filter((x) => x.url != bookmark.url)
      watchlist$.bookmarks.set(filtered)
    } else {
      watchlist$.bookmarks.unshift(bookmark)
    }
  },
  addBookmark: (bookmark) => {
    if (!watchlist$.urls.has(bookmark.url)) {
      watchlist$.bookmarks.unshift(bookmark)
    }
  },
  importBookmarks: (bookmarks) => {
    const xs = bookmarks.filter((x) => !watchlist$.urls.has(x.url))
    watchlist$.bookmarks.push(...xs)
    return xs.length
  },
})

if (isWeb) {
  syncObservable(watchlist$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'watchlist',
      },
    },
  })
} else {
  syncObservable(watchlist$, {
    persist: {
      name: 'watchlist',
      plugin: ObservablePersistMMKV,
    },
  })
}
