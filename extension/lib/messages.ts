import { browser } from 'wxt/browser'
import type { BlocklistSnapshot } from '@/lib/blocklist'
import type { UserStylesSnapshot } from '@/lib/user-styles'
import type { SettingsSnapshot } from '@/states/settings'
import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'
import type { StoredAuth, StoredCollection, StoredFeed } from './app/store'

export interface AppSnapshot {
  settings: SettingsSnapshot
  blocklist: BlocklistSnapshot
  userStyles: UserStylesSnapshot
  bookmarks: StoredCollection<Bookmark>
  folders: StoredCollection<Folder>
  feeds: { feeds: StoredFeed[]; bookmarks: Bookmark[] }
  auth: StoredAuth
  syncing: boolean
  syncError?: string
  userScripts: 'ready' | 'unavailable'
}

export type RequestMessage =
  | { type: 'snapshot' }
  | { type: 'set-settings'; settings: SettingsSnapshot }
  | { type: 'set-blocklist'; blocklist: BlocklistSnapshot }
  | { type: 'set-user-styles'; userStyles: UserStylesSnapshot }
  | { type: 'set-bookmarks'; bookmarks: StoredCollection<Bookmark> }
  | { type: 'set-folders'; folders: StoredCollection<Folder> }
  | { type: 'set-feed-bookmarks'; bookmarks: Bookmark[] }
  | { type: 'sign-in' }
  | { type: 'sign-out' }
  | { type: 'sync-now' }
  | { type: 'refresh-feeds'; bookmarkId?: string }
  | { type: 'noutube:fetch-feed'; url: string }

export interface ResponseMessage<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface StateChangedMessage {
  type: 'state-changed'
}

export async function request<T = unknown>(message: RequestMessage): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as ResponseMessage<T>
  if (!response?.ok) {
    throw new Error(response?.error || 'Extension request failed')
  }
  return response.data as T
}

export const getSnapshot = () => request<AppSnapshot>({ type: 'snapshot' })
