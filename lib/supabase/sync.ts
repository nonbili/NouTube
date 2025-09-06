import { Bookmark, bookmarks$ } from '@/states/bookmarks'
import { supabase } from './client'
import { syncState, when } from '@legendapp/state'
import { auth$ } from '@/states/auth'
import { debounce } from 'es-toolkit'
import { bookmarksSyncer } from './sync/bookmarks'
import { foldersSyncer } from './sync/folders'
import { folders$ } from '@/states/folders'
import { ui$ } from '@/states/ui'
import { feederLoop } from '../feeder'

const oneDay = 24 * 3600 * 1000
export async function syncSupabase() {
  const fullSyncedAt = ui$.fullSyncedAt.get()
  const fullSync = !fullSyncedAt || Date.now() - fullSyncedAt.valueOf() > oneDay
  await Promise.all([bookmarksSyncer.sync(fullSync), foldersSyncer.sync(fullSync)])
  if (fullSync) {
    ui$.fullSyncedAt.set(new Date())
  }
}

bookmarks$.bookmarks.onChange(() => {
  if (ui$.fullSyncedAt.get()) {
    bookmarksSyncer.sync()
  }
  feederLoop()
})

folders$.folders.onChange(() => {
  if (ui$.fullSyncedAt.get()) {
    foldersSyncer.sync()
  }
})
