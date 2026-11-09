import { syncState, when } from '@legendapp/state'
import { Bookmark, bookmarks$ } from '@/states/bookmarks'
import { RowSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { RowSyncer } from './base'

const time = (value: Date) => new Date(value).getTime() || 0

/**
 * The server keeps one bookmark per url. Two devices saving the same page each make a row of their
 * own: the one the server has stays, with the content saved here when this device has a copy not
 * pushed yet, as for any row changed here. Times are not compared: the server stamps its own.
 */
export function foldBookmarksByUrl(rows: Bookmark[], synced: (id: string) => boolean) {
  const groups = new Map<string, Bookmark[]>()
  for (const row of rows) {
    const group = groups.get(row.url)
    if (group) group.push(row)
    else groups.set(row.url, [row])
  }

  const replaced = new Map<string, Bookmark>()
  const changed: string[] = []
  const dropped = new Set<string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const keeper = group.find((row) => synced(row.id)) ?? group.reduce((a, b) => (time(a.created_at) <= time(b.created_at) ? a : b))
    const unsynced = group.filter((row) => !synced(row.id))
    const newest = (unsynced.length ? unsynced : group).reduce((a, b) => (time(b.updated_at) > time(a.updated_at) ? b : a))
    const createdAt = group.reduce((a, b) => (time(b.created_at) < time(a.created_at) ? b : a)).created_at
    const kept: Bookmark = { ...keeper, title: newest.title, json: newest.json, created_at: createdAt, updated_at: newest.updated_at }
    replaced.set(keeper.id, kept)
    if (JSON.stringify(kept) !== JSON.stringify(keeper)) changed.push(keeper.id)
    group.filter((row) => row !== keeper).forEach((row) => dropped.add(row.id))
  }

  if (!replaced.size) return { rows, changed, dropped: [] }
  return {
    rows: rows.filter((row) => !dropped.has(row.id)).map((row) => replaced.get(row.id) ?? row),
    changed,
    dropped: [...dropped],
  }
}

class BookmarksSyncer extends RowSyncer<Bookmark> {
  NAME = 'bookmarks'
  TABLE_NAME = 'nou_bookmarks'
  COLUMNS = 'id,url,title,json,created_at,updated_at'

  isPersistLoaded = () =>
    when(() => syncState(bookmarks$).isPersistLoaded.get() && syncState(syncMeta$).isPersistLoaded.get())

  getRows() {
    return bookmarks$.bookmarks.peek()
  }

  setRows(rows: Bookmark[]) {
    bookmarks$.assign({ bookmarks: rows, updatedAt: new Date() })
  }

  override fold(rows: Bookmark[], synced: (id: string) => boolean) {
    return foldBookmarksByUrl(rows, synced)
  }

  getMeta() {
    return syncMeta$.bookmarks.peek()
  }

  setMeta(meta: Partial<RowSyncMeta>) {
    syncMeta$.bookmarks.assign(meta)
  }
}

export const bookmarksSyncer = new BookmarksSyncer()
