import { syncState, type Observable } from '@legendapp/state'
import { bookmarks$ } from '@/states/bookmarks'
import { folders$ } from '@/states/folders'
import { getSettingsSnapshot, settings$ } from '@/states/settings'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import type { UserStylesSnapshot } from '@/lib/user-styles'
import { createLogger } from '@/lib/log'
import { feederLoop } from '@/lib/feeder'
import { bookmarksSyncer } from './bookmarks'
import { foldersSyncer } from './folders'
import { settingsSyncer } from './settings'
import { userStylesSyncer } from './user-styles'
import { canSync } from './session'

const logger = createLogger('sync', { devOnly: true })

// Persisted stores emit an onChange when MMKV/IndexedDB hydration replaces the
// defaults. That is not a local edit, so ignore changes until hydration lands.
const isHydrated = (observable$: Observable<any>) => syncState(observable$).isPersistLoaded.get()

/**
 * Marks what changed here to be synced. The extension calls this once its stored state is in
 * place, as hydrating it would otherwise look like a local edit.
 */
export function watchLocalSyncChanges(options: { requireHydrated: boolean; onUserStylesChange?: (value: UserStylesSnapshot) => void }) {
  const ready = (observable$: Observable<any>) => !options.requireHydrated || isHydrated(observable$)

  const subscriptions = [
    settings$.onChange(({ value, getPrevious }) => {
      if (settingsSyncer.isApplyingRemote() || !ready(settings$)) {
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
    }),

    userStyles$.onChange(({ value, getPrevious }) => {
      const previous = getPrevious()
      if (!previous || !ready(userStyles$)) {
        return
      }

      const snapshot = getUserStylesSnapshot(value)
      if (JSON.stringify(snapshot) === JSON.stringify(getUserStylesSnapshot(previous))) {
        return
      }

      // Pulled or merged styles change what runs on the page too; only they are not a local edit.
      options.onUserStylesChange?.(snapshot)
      if (userStylesSyncer.isApplyingRemote()) {
        return
      }

      logger.log('detected local user styles change')
      userStylesSyncer.markDirty()
      if (canSync()) {
        userStylesSyncer.scheduleSync()
      }
    }),

    bookmarks$.bookmarks.onChange(({ value, getPrevious }) => {
      if (!bookmarksSyncer.isApplyingRemote() && ready(bookmarks$)) {
        if (bookmarksSyncer.trackLocalChange(value, getPrevious())) {
          logger.log('detected local bookmarks change')
          if (canSync()) {
            bookmarksSyncer.scheduleSync()
          }
        }
      }

      void feederLoop()
    }),

    folders$.folders.onChange(({ value, getPrevious }) => {
      if (foldersSyncer.isApplyingRemote() || !ready(folders$)) {
        return
      }

      if (foldersSyncer.trackLocalChange(value, getPrevious())) {
        logger.log('detected local folders change')
        if (canSync()) {
          foldersSyncer.scheduleSync()
        }
      }
    }),
  ]

  return () => subscriptions.forEach((unsubscribe) => unsubscribe())
}
