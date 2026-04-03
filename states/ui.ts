import { event, observable } from '@legendapp/state'
import type { Folder } from './folders'
import type { Bookmark } from './bookmarks'
import { unnormalizeUrl } from '@/lib/url'
import { isWeb } from '@/lib/utils'

interface Store {
  url: string
  pageUrl: string

  // header
  headerHeight: number
  headerShown: boolean

  // modals
  bookmarkModalBookmark: Bookmark | undefined
  bookmarkModalMode: 'default' | 'feed'
  embedVideoId: string
  feedModalOpen: boolean
  folderModalFolder: Folder | undefined
  historyModalOpen: boolean
  libraryModalOpen: boolean
  libraryModalTab: string
  queueModalOpen: boolean
  settingsModalOpen: boolean
  sleepTimerModalOpen: boolean
  playbackSpeedModalOpen: boolean
  urlModalOpen: boolean
  cookieModalOpen: boolean
  userAgentModalOpen: boolean

  // webview
  webview: any
}

export const ui$ = observable<Store>({
  url: '',
  pageUrl: '',

  // header
  headerHeight: 0,
  headerShown: true,

  // modals
  bookmarkModalBookmark: undefined,
  bookmarkModalMode: 'default',
  embedVideoId: '',
  feedModalOpen: false,
  folderModalFolder: undefined,
  historyModalOpen: false,
  libraryModalOpen: false,
  libraryModalTab: '',
  queueModalOpen: false,
  settingsModalOpen: false,
  sleepTimerModalOpen: false,
  playbackSpeedModalOpen: false,
  urlModalOpen: false,
  cookieModalOpen: false,
  userAgentModalOpen: false,

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
