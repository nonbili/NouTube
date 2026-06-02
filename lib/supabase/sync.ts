import { auth$ } from '@/states/auth'
import { bookmarks$ } from '@/states/bookmarks'
import { folders$ } from '@/states/folders'
import { getSettingsSnapshot, settings$ } from '@/states/settings'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { createLogger } from '@/lib/log'
import { feederLoop } from '../feeder'
import { bookmarksSyncer } from './sync/bookmarks'
import { foldersSyncer } from './sync/folders'
import { settingsSyncer } from './sync/settings'
import { userStylesSyncer } from './sync/user-styles'

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
  await Promise.all([
    bookmarksSyncer.syncNow(),
    foldersSyncer.syncNow(),
    settingsSyncer.syncNow(),
    userStylesSyncer.syncNow(),
  ])
  logger.log('completed syncSupabase')
}

settings$.onChange(({ value, getPrevious }) => {
  if (settingsSyncer.isApplyingRemote()) {
    return
  }

  const previous = getPrevious()
  if (!previous) {
    return
  }

  if (JSON.stringify(getSettingsSnapshot(value)) !== JSON.stringify(getSettingsSnapshot(previous))) {
    logger.log('detected local settings change')
    settingsSyncer.markDirty()
    if (canSync()) {
      settingsSyncer.scheduleSync()
    }
  }
})

userStyles$.onChange(({ value, getPrevious }) => {
  if (userStylesSyncer.isApplyingRemote()) {
    return
  }

  const previous = getPrevious()
  if (!previous) {
    return
  }

  if (JSON.stringify(getUserStylesSnapshot(value)) !== JSON.stringify(getUserStylesSnapshot(previous))) {
    logger.log('detected local user styles change')
    userStylesSyncer.markDirty()
    if (canSync()) {
      userStylesSyncer.scheduleSync()
    }
  }
})

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
