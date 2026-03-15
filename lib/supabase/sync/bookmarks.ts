import { syncState, when } from '@legendapp/state'
import { Bookmark, bookmarks$ } from '@/states/bookmarks'
import { ResourceSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { BaseSyncer } from './base'

class BookmarksSyncer extends BaseSyncer<Bookmark> {
  NAME = 'bookmarks'
  TABLE_NAME = 'nou_bookmarks'
  COLUMNS = 'id,url,title,json,created_at,updated_at'
  pushWhenRemoteMissing = false

  isPersistLoaded = () => when(syncState(bookmarks$).isPersistLoaded)

  getStore() {
    const { bookmarks, updatedAt } = bookmarks$.get()
    return { items: bookmarks, updatedAt }
  }

  setStore({ items, updatedAt }: { items: Bookmark[]; updatedAt: Date }) {
    bookmarks$.assign({ bookmarks: items, updatedAt })
  }

  getMeta() {
    return syncMeta$.bookmarks.get()
  }

  setMeta(meta: Partial<ResourceSyncMeta<Bookmark[]>>) {
    syncMeta$.bookmarks.assign(meta)
  }

  hasMeaningfulLocalValue(items: Bookmark[]) {
    return items.some((item) => !item.json.deleted)
  }
}

export const bookmarksSyncer = new BookmarksSyncer()
