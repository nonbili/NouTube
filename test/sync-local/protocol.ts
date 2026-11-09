import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'
import type { SettingsSnapshot } from '@/states/settings'
import type { UserStylesSnapshot } from '@/lib/user-styles'

export type SyncScope = 'bookmarks' | 'folders' | 'settings' | 'userStyles'
export type DocumentScope = 'settings' | 'userStyles'

export type Command =
  | { op: 'snapshot' }
  | { op: 'bookmark'; url: string; title?: string }
  | { op: 'renameBookmark'; url: string; title: string }
  | { op: 'removeBookmark'; url: string }
  | { op: 'folder'; name: string }
  | { op: 'moveBookmark'; url: string; folderId: string | undefined }
  | { op: 'removeFolder'; id: string }
  | { op: 'settings'; value: Partial<SettingsSnapshot> }
  | { op: 'style'; enabled: boolean }
  | { op: 'customScript'; name: string }
  | { op: 'sync'; scope?: SyncScope }
  | { op: 'failNextPush'; path: string }
  | { op: 'signIn'; email: string; password: string }
  | { op: 'accountChoice'; choice: 'useAccount' | 'mergeDevice' }
  | { op: 'holdNextRequest'; path: string; method?: 'GET' | 'POST' }
  | { op: 'releaseFetch' }
  | { op: 'restoreBackup'; scope: DocumentScope }
  | { op: 'forgetBase'; scope: DocumentScope }

export interface Snapshot {
  bookmarks: Bookmark[]
  folders: Folder[]
  settings: SettingsSnapshot
  styles: UserStylesSnapshot
  meta: ReturnType<(typeof import('@/states/sync-meta'))['syncMeta$']['peek']>
  userId?: string
  needsAccountChoice: boolean
}

// Written by `bun scripts/sync-stack.ts start` in Inks.
function stackConnection(): { url?: string; anonKey?: string; serviceKey?: string } {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.inks-sync-stack.json'), 'utf8'))
  } catch {
    return {}
  }
}

export function localConfig() {
  const stack = stackConnection()
  const url = process.env.NOUTUBE_SYNC_URL ?? stack.url
  const anonKey = process.env.NOUTUBE_SYNC_ANON_KEY ?? stack.anonKey
  const serviceKey = process.env.NOUTUBE_SYNC_SERVICE_ROLE_KEY ?? stack.serviceKey
  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      'Local sync tests need a stack: run `bun scripts/sync-stack.ts start` in Inks, or set NOUTUBE_SYNC_URL, NOUTUBE_SYNC_ANON_KEY, and NOUTUBE_SYNC_SERVICE_ROLE_KEY',
    )
  }
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Local sync tests require a loopback HTTP Supabase URL')
  }
  return { url, anonKey, serviceKey }
}
