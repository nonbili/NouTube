import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
// page-type rather than lib/page: the latter pulls in states/ui and with it a
// states/tabs import cycle.
import { getPageType } from '@/lib/page-type'

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
  restoreHistory: (entries: History[]) => void
}

// The same video watched on YouTube and on YouTube Music is two entries: the
// modal splits the list by home, so keying on the video id alone would let one
// take the other's url over and disappear from the list it was in.
const getKey = (entry: Pick<History, 'videoId' | 'url'>) =>
  `${entry.videoId}|${getPageType(entry.url)?.home || ''}`

export const history$ = observable<Store>({
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(history$.bookmarks.get().map((x) => x.url))
  },
  size: (): number => {
    return history$.urls().size
  },
  removeHistory: (history) => {
    const filtered = history$.bookmarks.get().filter((x) => x.id != history.id)
    history$.bookmarks.set(filtered)
  },
  addHistory: (partial) => {
    // A spread would let an explicit undefined wipe a field the entry already
    // had, which is never what a partial update means here.
    const history = Object.fromEntries(
      Object.entries(partial).filter(([, value]) => value !== undefined),
    ) as Partial<History>
    const bookmarks = history$.bookmarks.get()
    if (!history.videoId || !history.url) {
      return
    }

    const key = getKey(history as History)
    // Every tick of the video being watched lands on the newest entry, so that
    // one is checked on its own before parsing the url of all the others.
    if (bookmarks[0] && getKey(bookmarks[0]) == key) {
      history$.bookmarks[0].assign({
        ...history,
        updatedAt: Date.now(),
      })
      return
    }

    // Matching only the newest entry would file every revisit as a new one, so
    // going back and forth between two videos fills the list with duplicates.
    const index = bookmarks.findIndex((x) => getKey(x) == key)

    const existing = index > 0 ? bookmarks[index] : undefined
    const next = {
      id: genId(),
      videoId: '',
      url: '',
      title: '',
      duration: 0,
      current: 0,
      // A rewatch keeps the entry it already had -- the payload only carries
      // what the player could read this tick.
      ...existing,
      ...history,
      updatedAt: Date.now(),
    } as History
    const rest = index > 0 ? bookmarks.filter((_, i) => i != index) : bookmarks
    history$.bookmarks.set([next, ...rest].slice(0, LIMIT))
  },
  restoreHistory: (entries) => {
    const current = history$.bookmarks.get()
    // Undo runs seconds later, with playback still recording: whatever has been
    // written since stays as it is, and only what is still missing comes back.
    const kept = new Set(current.flatMap((x) => [x.id, getKey(x)]))
    const restored = entries.filter((x) => !kept.has(x.id) && !kept.has(getKey(x)))
    if (!restored.length) {
      return
    }

    const next = [...current, ...restored].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    history$.bookmarks.set(next.slice(0, LIMIT))
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
