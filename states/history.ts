import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import type { Bookmark } from './bookmarks'
import { isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'

const LIMIT = 1000

interface Store {
  bookmarks: Bookmark[]
  urls: () => Set<string>
  size: () => number
  toggleBookmark: (bookmark: Bookmark) => void
  addBookmark: (bookmark: Bookmark) => void
}

export const history$ = observable<Store>({
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(history$.bookmarks.get().map((x) => x.url))
  },
  size: (): number => {
    return history$.urls.size
  },
  toggleBookmark: (bookmark) => {
    if (history$.urls.has(bookmark.url)) {
      const filtered = history$.bookmarks.get().filter((x) => x.url != bookmark.url)
      history$.bookmarks.set(filtered)
    } else {
      history$.bookmarks.unshift(bookmark)
    }
  },
  addBookmark: (bookmark) => {
    const index = history$.bookmarks.findIndex((x) => x.url.get() == bookmark.url)
    if (index != -1) {
      history$.bookmarks.splice(index, 1)
    }
    history$.bookmarks.unshift(bookmark)
    if (history$.bookmarks.length > LIMIT) {
      history$.bookmarks.splice(LIMIT, history$.bookmarks.length)
    }
  },
})

if (isWeb) {
  syncObservable(history$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'history',
      },
    },
  })
} else {
  syncObservable(history$, {
    persist: {
      name: 'history',
      plugin: ObservablePersistMMKV,
    },
  })
}
