import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'

const LIMIT = 1000

export interface History {
  id: string
  videoId: string
  url: string
  title: string
  thumbnail?: string
  duration: number
  current: number
  updatedAt: number
}

interface Store {
  bookmarks: History[]
  urls: () => Set<string>
  size: () => number
  removeHistory: (history: History) => void
  addHistory: (history: Partial<History>) => void
}

export const history$ = observable<Store>({
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(history$.bookmarks.get().map((x) => x.url))
  },
  size: (): number => {
    return history$.urls.size
  },
  removeHistory: (history) => {
    const filtered = history$.bookmarks.get().filter((x) => x.id != history.id)
    history$.bookmarks.set(filtered)
  },
  addHistory: (history) => {
    const latest = history$.bookmarks[0].get()
    if (latest && latest.videoId == history.videoId) {
      history$.bookmarks[0].assign({
        ...history,
        updatedAt: Date.now(),
      })
    } else {
      history$.bookmarks.unshift({
        id: genId(),
        videoId: '',
        url: '',
        title: '',
        duration: 0,
        current: 0,
        ...history,
        updatedAt: Date.now(),
      } as History)
    }

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
