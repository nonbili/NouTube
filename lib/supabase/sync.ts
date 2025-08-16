import { Bookmark, bookmarks$ } from '@/states/bookmarks'
import { supabase } from './client'
import { syncState, when } from '@legendapp/state'
import { auth$ } from '@/states/auth'
import { debounce } from 'es-toolkit'

const PAGE_SIZE = 1000

async function fetchBookmarks(start = 0, end = PAGE_SIZE - 1): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from('nou_bookmarks')
    .select('id,url,title,json,created_at,updated_at')
    .order('created_at', { ascending: false })
    .range(start, end)
  if (error) {
    console.error(error)
    return []
  }
  let next: Bookmark[] = []
  if (data.length == PAGE_SIZE) {
    next = await fetchBookmarks(start + PAGE_SIZE, end + PAGE_SIZE)
  }
  return data
    .map((x) => ({
      ...x,
      created_at: new Date(x.created_at),
      updated_at: new Date(x.updated_at),
    }))
    .concat(next)
}

async function saveBookmarks(bookmarks: Bookmark[]) {
  const user_id = auth$.userId.get()
  if (!user_id) {
    return
  }

  const { count, error } = await supabase.from('nou_bookmarks').upsert(
    bookmarks.map((x) => ({
      ...x,
      user_id,
    })),
    { count: 'estimated' },
  )
  if (error) {
    throw error
  }
  console.log(`saved ${count} bookmarks`)
}

async function _syncBookmarks() {
  await when(syncState(bookmarks$).isPersistLoaded)
  const { userId: user_id, plan } = auth$.get()
  if (!user_id || !plan || plan == 'free') {
    return
  }

  const { data, error } = await supabase.from('nou_sync_states').select('json')
  if (error) {
    throw error
  }

  const remoteSyncState = data[0]?.json
  const remoteUpdatedAt = new Date(remoteSyncState?.bookmarks_updated_at || 1970)
  const { bookmarks, updatedAt, syncedAt } = bookmarks$.get()
  console.log('syncBookmarks', remoteSyncState, updatedAt, syncedAt)

  const updateRemoteSyncState = async (bookmarks_updated_at: Date) => {
    await supabase.from('nou_sync_states').upsert({ json: { ...remoteSyncState, bookmarks_updated_at }, user_id })
  }

  if (!syncedAt && bookmarks.length) {
    const remoteBookmarks = await fetchBookmarks()
    // 1. sync local -> remote
    await saveBookmarks(bookmarks)
    // 2. sync remote -> local
    bookmarks$.importBookmarks(remoteBookmarks)
    if (updatedAt > remoteUpdatedAt) {
      await updateRemoteSyncState(updatedAt)
    }
  }

  if (!remoteSyncState) {
    if (bookmarks.length) {
      // full sync: local -> remote
      console.log('full sync: local -> remote')
      await saveBookmarks(bookmarks)
      await updateRemoteSyncState(updatedAt)
    }
    bookmarks$.setSyncedTime()
    return
  }

  if (remoteUpdatedAt > updatedAt) {
    // full sync: remote -> local
    console.log('full sync: remote -> local')
    const remoteBookmarks = await fetchBookmarks()
    bookmarks$.assign({
      bookmarks: remoteBookmarks,
      updatedAt: remoteUpdatedAt,
    })
  } else if (remoteUpdatedAt < updatedAt) {
    // partial sync: local -> remote
    console.log('partial sync: local -> remote')
    const updates = bookmarks.filter((x) => x.updated_at > remoteUpdatedAt)
    await saveBookmarks(updates)
    await updateRemoteSyncState(updatedAt)
  }

  bookmarks$.setSyncedTime()
}

const debouncedSyncBookmakrs = debounce(
  _syncBookmarks,
  60 * 1000, // 1 minute
  { edges: ['leading', 'trailing'] },
)

export function syncBookmarks() {
  const { userId, plan } = auth$.get()
  if (userId && plan && plan != 'free') {
    debouncedSyncBookmakrs()
  }
}

bookmarks$.bookmarks.onChange(({ value }) => {
  syncBookmarks()
})
