import { createLogger } from '@/lib/log'
import { bookmarksSyncer } from './sync/bookmarks'
import { foldersSyncer } from './sync/folders'
import { settingsSyncer } from './sync/settings'
import { userStylesSyncer } from './sync/user-styles'
import { canSync } from './sync/session'
import { watchLocalSyncChanges } from './sync/watch'

const logger = createLogger('sync', { devOnly: true })

export async function syncSupabase() {
  if (!canSync()) {
    logger.log('skipped syncSupabase because sync is disabled')
    return
  }

  logger.log('starting syncSupabase')
  await Promise.all([
    bookmarksSyncer.syncNow(),
    foldersSyncer.syncNow(),
    settingsSyncer.syncNow(),
    userStylesSyncer.syncNow(),
  ])
  logger.log('completed syncSupabase')
}

watchLocalSyncChanges({ requireHydrated: true })
