import { syncState, when } from '@legendapp/state'
import { Bookmark, bookmarks$ } from '@/states/bookmarks'
import { BaseSyncer } from './base'

class BookmarksSyncer extends BaseSyncer<Bookmark> {
  NAME = 'bookmarks'
  TABLE_NAME = 'nou_bookmarks'
  COLUMNS = 'id,url,title,json,created_at,updated_at'
  SYNC_STATE_FIELD = 'bookmarks_updated_at'

  isPersistLoaded = () => when(syncState(bookmarks$).isPersistLoaded)

  getStore() {
    const { bookmarks, updatedAt, syncedAt } = bookmarks$.get()
    return { items: bookmarks, updatedAt, syncedAt }
  }

  setStore({ items, updatedAt }: { items: Bookmark[]; updatedAt: Date }) {
    bookmarks$.assign({ bookmarks: items, updatedAt })
  }

  importItems(items: Bookmark[]) {
    bookmarks$.importBookmarks(items)
  }

  setSyncedTime() {
    bookmarks$.setSyncedTime()
  }
}

export const bookmarksSyncer = new BookmarksSyncer()
