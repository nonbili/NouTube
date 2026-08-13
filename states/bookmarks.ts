import { batch, Observable, observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import { normalizeUrl } from '@/lib/url'
import { showUndoToast } from './undo-toast'
import { t } from 'i18next'

export interface Bookmark {
  id: string
  url: string
  title: string
  thumbnail?: string
  created_at: Date
  updated_at: Date
  json: {
    id?: string
    thumbnail?: string
    deleted?: boolean
    folder?: string
  }
}

interface Store {
  bookmarks: Bookmark[]
  updatedAt: Date
  getBookmarkByUrl: (url: string) => Observable<Bookmark> | undefined
  toggleBookmark: (bookmark: Bookmark) => void
  addBookmark: (bookmark: Bookmark) => void
  saveBookmark: (bookmark: Bookmark) => void
  importBookmarks: (bookmarks: Bookmark[]) => void
  removeByFolder: (folderId: string) => void
  removeById: (bookmarkId: string) => boolean
  restoreByIds: (bookmarkIds: string[]) => void
  moveToFolder: (bookmarkId: string, folderId: string | undefined) => boolean
  setUpdatedTime: () => void
}

const getBookmarkIndex = (bookmark: Bookmark) => bookmarks$.bookmarks.findIndex((x) => x.id.get() == bookmark.id)

export const bookmarks$ = observable<Store>({
  bookmarks: [],
  updatedAt: new Date(1970),
  getBookmarkByUrl: (url): Observable<Bookmark> | undefined => {
    const x = bookmarks$.bookmarks.find((x) => x.url.get() == url)
    return x
  },
  toggleBookmark: (bookmark) => {
    const existing = bookmarks$.getBookmarkByUrl(bookmark.url)
    if (existing) {
      const json = existing.json.get()
      existing.assign({
        updated_at: new Date(),
        json: {
          ...json,
          deleted: !json.deleted,
        },
      })
    } else {
      bookmark.url = normalizeUrl(bookmark.url)
      bookmarks$.bookmarks.unshift(bookmark)
    }
    bookmarks$.setUpdatedTime()
  },
  addBookmark: (bookmark) => {
    bookmark.url = normalizeUrl(bookmark.url)
    if (!bookmarks$.getBookmarkByUrl(bookmark.url)) {
      bookmarks$.bookmarks.unshift(bookmark)
      bookmarks$.setUpdatedTime()
    }
  },
  saveBookmark: (bookmark) => {
    const index = getBookmarkIndex(bookmark)
    if (index != -1) {
      bookmark.updated_at = new Date()
      bookmarks$.bookmarks[index].set(bookmark)
    } else {
      bookmarks$.bookmarks.unshift(bookmark)
    }
    bookmarks$.setUpdatedTime()
  },
  importBookmarks: (bookmarks) => {
    if (!bookmarks.length) {
      return 0
    }
    const bookmarkUrls = getBookmarkUrls()
    const xs = bookmarks
      .map((x) => {
        x.url = normalizeUrl(x.url)
        return x
      })
      .filter((x) => !bookmarkUrls.has(x.url))
    bookmarks$.bookmarks.unshift(...xs)
    bookmarks$.setUpdatedTime()
    return xs.length
  },
  removeByFolder: (folderId: string) => {
    const bookmarks = bookmarks$.bookmarks.filter((x) => x.json.folder.get() == folderId)
    const now = new Date()
    batch(() => {
      bookmarks.forEach((x) => {
        x.updated_at.set(now)
        x.json.deleted.set(true)
      })
      bookmarks$.setUpdatedTime()
    })
  },
  removeById: (bookmarkId) => {
    const bookmark = bookmarks$.bookmarks.find((x) => x.id.get() === bookmarkId)
    if (!bookmark || bookmark.json.deleted.get()) {
      return false
    }
    const json = bookmark.json.get()
    bookmark.updated_at.set(new Date())
    bookmark.json.set({ ...json, deleted: true })
    bookmarks$.setUpdatedTime()
    return true
  },
  restoreByIds: (bookmarkIds) => {
    const ids = new Set(bookmarkIds)
    const bookmarks = bookmarks$.bookmarks.filter((x) => ids.has(x.id.get()))
    const now = new Date()
    batch(() => {
      bookmarks.forEach((x) => {
        const json = x.json.get()
        x.updated_at.set(now)
        x.json.set({ ...json, deleted: false })
      })
      bookmarks$.setUpdatedTime()
    })
  },
  moveToFolder: (bookmarkId, folderId) => {
    const bookmark = bookmarks$.bookmarks.find((x) => x.id.get() === bookmarkId)
    if (!bookmark || bookmark.json.deleted.get()) {
      return false
    }
    const json = bookmark.json.get()
    bookmark.updated_at.set(new Date())
    bookmark.json.set({ ...json, folder: folderId })
    bookmarks$.setUpdatedTime()
    return true
  },
  setUpdatedTime() {
    bookmarks$.updatedAt.set(new Date())
  },
})

export function removeBookmark(bookmark: Bookmark) {
  let existing = bookmarks$.bookmarks.find((item) => item.id.get() === bookmark.id)
  if (!existing) {
    let normalizedUrl: string
    try {
      normalizedUrl = normalizeUrl(bookmark.url)
    } catch {
      return
    }
    existing = bookmarks$.bookmarks.find((item) => item.url.get() === normalizedUrl && !item.json.deleted.get())
  }
  const bookmarkId = existing?.id.get()
  if (!bookmarkId || !bookmarks$.removeById(bookmarkId)) {
    return
  }
  showUndoToast(t('bookmarks.removed'), () => bookmarks$.restoreByIds([bookmarkId]))
}

if (isWeb) {
  syncObservable(bookmarks$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'bookmarks',
      },
    },
  })
} else {
  syncObservable(bookmarks$, {
    persist: {
      name: 'bookmarks',
      plugin: ObservablePersistMMKV,
    },
  })
}

export function newBookmark(bookmark?: Partial<Bookmark>): Bookmark {
  if (bookmark?.url) {
    bookmark.url = normalizeUrl(bookmark.url)
  }
  return {
    url: '',
    title: '',
    id: genId(),
    json: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...bookmark,
  }
}

export function getBookmarkUrls() {
  return new Set(
    bookmarks$.bookmarks
      .get()
      .filter((x) => !x.json.deleted)
      .map((x) => x.url),
  )
}
