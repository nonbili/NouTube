import { auth$ } from '@/states/auth'
import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'
import { emptyRowMeta, syncMeta$ } from '@/states/sync-meta'
import { exportBookmarksCsv } from '@/lib/export'
import { exportSettingsJson } from '@/lib/settings-transfer'
import { createLogger } from '@/lib/log'
import { genId } from '@/lib/utils'
import type { DocumentSyncer, RemoteDocument } from './document-base'
import { bookmarksSyncer } from './bookmarks'
import { foldersSyncer } from './folders'
import { settingsSyncer } from './settings'
import { userStylesSyncer } from './user-styles'
import {
  bumpSyncGeneration,
  getSyncGeneration,
  getSyncOwner,
  hasSyncPlan,
  needsAccountChoice,
  setSwitchingAccount,
} from './session'

const logger = createLogger('sync').child('account')

/**
 * What to do with the data on this device when it belongs to another account:
 * - useAccount: put the signed-in account's data in its place.
 * - mergeDevice: add it to the signed-in account; what the account has of the same thing stays.
 */
export type AccountChoice = 'useAccount' | 'mergeDevice'

// The next run reads every row, as on a new device.
const resetRowMeta = (pendingIds: string[] = []) => ({ ...emptyRowMeta(), pendingIds })

/** The account's document in place of this device's; without one, this device's is pushed to it. */
const replaceDocument = <T>(syncer: DocumentSyncer<T>, remote: RemoteDocument<T> | null) => {
  if (remote) syncer.applyRemote(remote.value)
  syncer.setMeta({
    dirty: !remote,
    lastError: undefined,
    backup: undefined,
    lastSyncedRemoteUpdatedAt: remote?.updatedAt,
    base: remote?.value,
  })
}

/** The account's document stays, this device's kept as the backup; else this device's is pushed. */
const keepAccountDocument = <T>(syncer: DocumentSyncer<T>, remote: RemoteDocument<T> | null) => {
  if (remote) {
    syncer.setMeta({ backup: { value: syncer.getValue(), savedAt: Date.now(), remoteUpdatedAt: remote.updatedAt } })
    syncer.applyRemote(remote.value)
  }
  syncer.setMeta({
    dirty: !remote,
    lastError: undefined,
    lastSyncedRemoteUpdatedAt: remote?.updatedAt,
    base: remote?.value,
  })
}

const fetchAccountData = () =>
  Promise.all([settingsSyncer.fetchRemote(), userStylesSyncer.fetchRemote(), bookmarksSyncer.fetchRows(), foldersSyncer.fetchRows()])

/**
 * This device's folders and bookmarks added to an account. Row ids are unique across accounts, so
 * what is added gets new ids; a folder of the same tab and name, or a bookmark of the same url, is
 * the account's own.
 */
export function mergeDeviceRows(
  localFolders: Folder[],
  localBookmarks: Bookmark[],
  remoteFolders: Folder[],
  remoteBookmarks: Bookmark[],
  newId: () => string = genId,
) {
  const now = new Date()
  const folderKey = (folder: Folder) => `${folder.json.tab}\n${folder.name}`
  const accountFolders = new Map(remoteFolders.filter((row) => !row.json.deleted).map((row) => [folderKey(row), row.id]))
  const folderIds = new Map<string, string>()
  const addedFolders: Folder[] = []
  for (const folder of localFolders) {
    if (folder.json.deleted) continue
    const existing = accountFolders.get(folderKey(folder))
    if (existing) {
      folderIds.set(folder.id, existing)
      continue
    }
    const added = { ...folder, id: newId(), updated_at: now }
    accountFolders.set(folderKey(added), added.id)
    folderIds.set(folder.id, added.id)
    addedFolders.push(added)
  }

  const accountBookmarks = new Map(remoteBookmarks.map((row) => [row.url, row]))
  const restored = new Map<string, Bookmark>()
  const addedBookmarks: Bookmark[] = []
  for (const bookmark of localBookmarks) {
    if (bookmark.json.deleted) continue
    const folder = bookmark.json.folder ? folderIds.get(bookmark.json.folder) : undefined
    const json = { ...bookmark.json, folder }
    const existing = accountBookmarks.get(bookmark.url)
    if (existing && !existing.json.deleted) continue
    if (existing) {
      // The account has it taken away: the server keeps one row per url, so that row comes back.
      const row = { ...existing, title: bookmark.title, json: { ...json, deleted: false }, updated_at: now }
      accountBookmarks.set(row.url, row)
      restored.set(row.id, row)
      continue
    }
    const added = { ...bookmark, id: newId(), json, updated_at: now }
    accountBookmarks.set(added.url, added)
    addedBookmarks.push(added)
  }

  return {
    folders: [...remoteFolders, ...addedFolders],
    bookmarks: [...remoteBookmarks.map((row) => restored.get(row.id) ?? row), ...addedBookmarks],
    pendingFolderIds: addedFolders.map((row) => row.id),
    pendingBookmarkIds: [...restored.keys(), ...addedBookmarks.map((row) => row.id)],
  }
}

/** Gives the data on this device to the signed-in account, as the user chose, then syncs it. */
export async function resolveAccountChoice(choice: AccountChoice) {
  const userId = auth$.userId.peek()
  if (!userId || !hasSyncPlan() || !needsAccountChoice()) return

  // Nothing else syncs while the data changes hands.
  setSwitchingAccount(true)
  bumpSyncGeneration()
  // Any change of account meanwhile, even one that came back to this account, makes what was
  // read a mix of accounts: none of it is used.
  const generation = getSyncGeneration()
  try {
    const fromUserId = getSyncOwner()
    const [settings, styles, bookmarks, folders] = await fetchAccountData()
    if (getSyncGeneration() !== generation || auth$.userId.peek() !== userId) {
      logger.log('account changed while switching; stopped')
      return
    }

    // Taken right before the data changes hands, so it has what was changed here while reading.
    syncMeta$.switchBackup.set({
      fromUserId,
      savedAt: Date.now(),
      bookmarksCsv: exportBookmarksCsv(),
      settingsJson: exportSettingsJson(),
    })

    if (choice === 'useAccount') {
      replaceDocument(settingsSyncer, settings)
      replaceDocument(userStylesSyncer, styles)
      foldersSyncer.applyRemote(folders)
      bookmarksSyncer.applyRemote(bookmarks)
      syncMeta$.folders.set(resetRowMeta())
      syncMeta$.bookmarks.set(resetRowMeta())
    } else {
      // Settings and styles are one thing each, not put together.
      keepAccountDocument(settingsSyncer, settings)
      keepAccountDocument(userStylesSyncer, styles)
      const merged = mergeDeviceRows(foldersSyncer.getRows(), bookmarksSyncer.getRows(), folders, bookmarks)
      foldersSyncer.applyRemote(merged.folders)
      bookmarksSyncer.applyRemote(merged.bookmarks)
      syncMeta$.folders.set(resetRowMeta(merged.pendingFolderIds))
      syncMeta$.bookmarks.set(resetRowMeta(merged.pendingBookmarkIds))
    }
    syncMeta$.ownerUserId.set(userId)
  } finally {
    setSwitchingAccount(false)
    bumpSyncGeneration()
  }

  await Promise.all([
    bookmarksSyncer.syncNow(),
    foldersSyncer.syncNow(),
    settingsSyncer.syncNow(),
    userStylesSyncer.syncNow(),
  ])
}
