import { auth$ } from '@/states/auth'
import { bookmarks$ } from '@/states/bookmarks'
import { folders$ } from '@/states/folders'
import { createLogger } from '@/lib/log'
import { feederLoop } from '../feeder'
import { bookmarksSyncer } from './sync/bookmarks'
import { foldersSyncer } from './sync/folders'

const logger = createLogger('sync', { devOnly: true })

const canSync = () => {
  const { userId, plan } = auth$.get()
  return Boolean(userId && plan && plan !== 'free')
}

export async function syncSupabase() {
  if (!canSync()) {
    logger.log('skipped syncSupabase because sync is disabled')
    return
  }

  logger.log('starting syncSupabase')
  await Promise.all([bookmarksSyncer.syncNow(), foldersSyncer.syncNow()])
  logger.log('completed syncSupabase')
}

bookmarks$.bookmarks.onChange(() => {
  if (!bookmarksSyncer.isApplyingRemote()) {
    logger.log('detected local bookmarks change')
    bookmarksSyncer.markDirty()
    if (canSync()) {
      bookmarksSyncer.scheduleSync()
    }
  }

  feederLoop()
})

folders$.folders.onChange(() => {
  if (foldersSyncer.isApplyingRemote()) {
    return
  }

  logger.log('detected local folders change')
  foldersSyncer.markDirty()
  if (canSync()) {
    foldersSyncer.scheduleSync()
  }
})
