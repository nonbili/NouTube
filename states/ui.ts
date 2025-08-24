import { event, observable } from '@legendapp/state'
import { settings$ } from './settings'
import { Folder } from './folders'
import { Bookmark } from './bookmarks'
import { unnormalizeUrl } from '@/lib/page'

interface Store {
  url: string
  pageUrl: string
  fullSyncedAt: Date | undefined
  // modals
  bookmarkModalBookmark: Bookmark | undefined
  folderModalFolder: Folder | undefined
  settingsModalOpen: boolean
  queueModalOpen: boolean
  embedVideoId: string
  libraryModalOpen: boolean
  libraryModalTab: string
  // webview
  webview: any
}

export const ui$ = observable<Store>({
  url: '',
  pageUrl: '',
  fullSyncedAt: undefined,
  // modals
  bookmarkModalBookmark: undefined,
  folderModalFolder: undefined,
  settingsModalOpen: false,
  queueModalOpen: false,
  embedVideoId: '',
  libraryModalOpen: false,
  libraryModalTab: '',
  // webview
  webview: undefined,
})

export function updateUrl(url: string) {
  const webview = ui$.webview.get()
  // workaround for beforeunload https://github.com/electron/electron/issues/43314#issuecomment-2399072938
  webview?.executeJavaScript('NouTube.pause()')
  ui$.url.set('')
  ui$.url.set(unnormalizeUrl(url))
}

export const onClearData$ = event()
