import { event, observable } from '@legendapp/state'
import { settings$ } from './settings'
import { Folder } from './folders'
import { Bookmark } from './bookmarks'

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
})

export function updateUrl(url: string) {
  ui$.url.set('')
  ui$.url.set(url)
}

export const onClearData$ = event()
