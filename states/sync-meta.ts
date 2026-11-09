import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
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
  // What was here, before a merge took the other device's side of something both changed.
  backup?: SyncBackup<T>
  // The document as this device and the server last agreed on it, to merge the two against.
  base?: T
}

export interface RowSyncMeta {
  // Rows changed here and not pushed yet.
  pendingIds: string[]
  // The account the cursor was read from.
  userId?: string
  // Rows changed after this were not pulled yet.
  cursor?: string
  lastFullPullAt?: number
  lastSuccessfulSyncAt?: number
  lastError?: string
}

export interface AccountSwitchBackup {
  // The account the data belonged to, when it was known.
  fromUserId?: string
  savedAt: number
  // Bookmarks as Settings › Export saves them, and a settings backup as Settings › Backup does.
  bookmarksCsv: string
  settingsJson: string
}

interface Store {
  bookmarks: RowSyncMeta
  folders: RowSyncMeta
  settings: ResourceSyncMeta<SettingsSnapshot>
  userStyles: ResourceSyncMeta<UserStylesSnapshot>
  // The account the synced data on this device belongs to.
  ownerUserId?: string
  // What was here before the data was handed to another account.
  switchBackup?: AccountSwitchBackup
}

const emptyMeta = <T>(): ResourceSyncMeta<T> => ({
  dirty: false,
  lastSyncedRemoteUpdatedAt: undefined,
  lastSuccessfulSyncAt: undefined,
  lastError: undefined,
  backup: undefined,
  base: undefined,
})

export const emptyRowMeta = (): RowSyncMeta => ({ pendingIds: [] })

// Rows were synced as a whole collection before; that metadata says nothing about single rows.
const normalizeRowMeta = (data?: Partial<RowSyncMeta>): RowSyncMeta => ({
  ...emptyRowMeta(),
  ...(Array.isArray(data?.pendingIds) ? data : undefined),
})

export const syncMeta$ = observable<Store>({
  bookmarks: emptyRowMeta(),
  folders: emptyRowMeta(),
  settings: emptyMeta<SettingsSnapshot>(),
  userStyles: emptyMeta<UserStylesSnapshot>(),
})

export const normalizeSyncMeta = (data?: Partial<Store>): Store => ({
  bookmarks: normalizeRowMeta(data?.bookmarks),
  folders: normalizeRowMeta(data?.folders),
  settings: { ...emptyMeta<SettingsSnapshot>(), ...data?.settings },
  userStyles: { ...emptyMeta<UserStylesSnapshot>(), ...data?.userStyles },
  ownerUserId: data?.ownerUserId,
  switchBackup: data?.switchBackup,
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
