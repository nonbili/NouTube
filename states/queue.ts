import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { Bookmark } from './watchlist'

interface Store {
  bookmarks: Bookmark[]
  urls: () => Set<string>
  size: () => number
  toggleBookmark: (bookmark: Bookmark) => void
  addBookmark: (bookmark: Bookmark) => void
}

export const queue$ = observable<Store>({
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(queue$.bookmarks.get().map((x) => x.url))
  },
  size: (): number => {
    return queue$.urls.size
  },
  toggleBookmark: (bookmark) => {
    if (queue$.urls.has(bookmark.url)) {
      const filtered = queue$.bookmarks.get().filter((x) => x.url != bookmark.url)
      queue$.bookmarks.set(filtered)
    } else {
      queue$.bookmarks.unshift(bookmark)
    }
  },
  addBookmark: (bookmark) => {
    if (!queue$.urls.has(bookmark.url)) {
      queue$.bookmarks.push(bookmark)
    }
  },
})

syncObservable(queue$, {
  persist: {
    name: 'queue',
    plugin: ObservablePersistMMKV,
  },
})
