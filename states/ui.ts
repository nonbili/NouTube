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
  embedVideoId: string
  feedModalOpen: boolean
  folderModalFolder: Folder | undefined
  historyModalOpen: boolean
  libraryModalOpen: boolean
  libraryModalTab: string
  queueModalOpen: boolean
  settingsModalOpen: boolean
  urlModalOpen: boolean

  // webview
  webview: any
}

export const ui$ = observable<Store>({
  url: '',
  pageUrl: '',
  fullSyncedAt: undefined,

  // modals
  bookmarkModalBookmark: undefined,
  embedVideoId: '',
  feedModalOpen: false,
  folderModalFolder: undefined,
  historyModalOpen: false,
  libraryModalOpen: false,
  libraryModalTab: '',
  queueModalOpen: false,
  settingsModalOpen: true,
  urlModalOpen: false,

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
    const { mainClient } = await import('../desktop/src/renderer/ipc/main')
    mainClient.clearData()
    webview.executeJavaScript('document.location.reload()')
  } else {
    webview.clearData()
  }
})
