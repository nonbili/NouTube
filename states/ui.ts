import { event, observable } from '@legendapp/state'
import { settings$ } from './settings'
import { Folder } from './folders'
import { Bookmark } from './bookmarks'
import { unnormalizeUrl } from '@/lib/url'
import { isWeb } from '@/lib/utils'

interface Store {
  url: string
  pageUrl: string
  fullSyncedAt: Date | undefined
  // modals
  bookmarkModalBookmark: Bookmark | undefined
  folderModalFolder: Folder | undefined
  historyModalOpen: boolean
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
  historyModalOpen: false,
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

onClearData$.on(async () => {
  const webview = ui$.webview.get()
  if (!webview) {
    return
  }
  if (isWeb) {
    const { mainClient } = await import('@renderer/ipc/main')
    mainClient.clearData()
    webview.executeJavaScript('document.location.reload()')
  } else {
    webview.clearData()
  }
})
