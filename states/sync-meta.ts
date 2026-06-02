import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import type { Bookmark } from './bookmarks'
import type { Folder } from './folders'
import type { SettingsSnapshot } from './settings'
import type { UserStylesSnapshot } from '@/lib/user-styles'
import { getIndexedDBPlugin } from './indexeddb'
import { isWeb } from '@/lib/utils'

export interface SyncBackup<T> {
  value: T
  savedAt: number
  remoteUpdatedAt?: string
}

export interface ResourceSyncMeta<T> {
  dirty: boolean
  lastSyncedRemoteUpdatedAt?: string
  lastSuccessfulSyncAt?: number
  lastError?: string
  backup?: SyncBackup<T>
}

interface Store {
  bookmarks: ResourceSyncMeta<Bookmark[]>
  folders: ResourceSyncMeta<Folder[]>
  settings: ResourceSyncMeta<SettingsSnapshot>
  userStyles: ResourceSyncMeta<UserStylesSnapshot>
}

const emptyMeta = <T>(): ResourceSyncMeta<T> => ({
  dirty: false,
  lastSyncedRemoteUpdatedAt: undefined,
  lastSuccessfulSyncAt: undefined,
  lastError: undefined,
  backup: undefined,
})

export const syncMeta$ = observable<Store>({
  bookmarks: emptyMeta<Bookmark[]>(),
  folders: emptyMeta<Folder[]>(),
  settings: emptyMeta<SettingsSnapshot>(),
  userStyles: emptyMeta<UserStylesSnapshot>(),
})

const normalizeSyncMeta = (data?: Partial<Store>): Store => ({
  bookmarks: { ...emptyMeta<Bookmark[]>(), ...data?.bookmarks },
  folders: { ...emptyMeta<Folder[]>(), ...data?.folders },
  settings: { ...emptyMeta<SettingsSnapshot>(), ...data?.settings },
  userStyles: { ...emptyMeta<UserStylesSnapshot>(), ...data?.userStyles },
})

if (isWeb) {
  syncObservable(syncMeta$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'syncMeta',
      },
      transform: {
        load: normalizeSyncMeta,
      },
    },
  })
} else {
  syncObservable(syncMeta$, {
    persist: {
      name: 'sync-meta',
      plugin: ObservablePersistMMKV,
      transform: {
        load: normalizeSyncMeta,
      },
    },
  })
}
