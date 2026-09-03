import { browser } from 'wxt/browser'
import { normalizeBlocklist, type BlocklistSnapshot } from '@/lib/blocklist'
import { normalizeUserStyles, type UserStylesSnapshot } from '@/lib/user-styles'
import { getSettingsSnapshot, type SettingsSnapshot } from '@/states/settings'
import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'

/*
 * The durable copy of everything the extension owns. The background is its only
 * writer: extension pages project it into the app's observables and send their
 * edits back, and the content scripts read the three keys they need straight out
 * of `browser.storage.local` without waiting for anyone.
 */
export interface StoredFeed {
  id: string
  fetchedAt: string
}

export interface StoredCollection<T> {
  items: T[]
  updatedAt: string
}

export interface StoredAuth {
  loaded: boolean
  userId?: string
  email?: string
  plan: string
}

export interface StoredState {
  settings: SettingsSnapshot
  blocklist: BlocklistSnapshot
  userStyles: UserStylesSnapshot
  bookmarks: StoredCollection<Bookmark>
  folders: StoredCollection<Folder>
  feeds: { feeds: StoredFeed[]; bookmarks: Bookmark[] }
  syncMeta: Record<string, unknown>
  auth: StoredAuth
}

export type StoredKey = keyof StoredState

export const storedKeys: StoredKey[] = [
  'settings',
  'blocklist',
  'userStyles',
  'bookmarks',
  'folders',
  'feeds',
  'syncMeta',
  'auth',
]

const epoch = new Date(0).toISOString()

export const createDefaultStoredState = (): StoredState => ({
  settings: getSettingsSnapshot({}),
  blocklist: normalizeBlocklist(),
  userStyles: normalizeUserStyles(),
  bookmarks: { items: [], updatedAt: epoch },
  folders: { items: [], updatedAt: epoch },
  feeds: { feeds: [], bookmarks: [] },
  syncMeta: {},
  auth: { loaded: false, plan: 'free' },
})

export async function loadStoredState(): Promise<StoredState> {
  const defaults = createDefaultStoredState()
  try {
    const stored = (await browser.storage.local.get(storedKeys)) as Partial<StoredState>
    return {
      ...defaults,
      ...stored,
      settings: getSettingsSnapshot({ ...defaults.settings, ...stored.settings }),
      blocklist: normalizeBlocklist(stored.blocklist),
      userStyles: normalizeUserStyles(stored.userStyles),
    }
  } catch {
    return defaults
  }
}

export async function saveStoredState(patch: Partial<StoredState>) {
  await browser.storage.local.set(patch)
}
