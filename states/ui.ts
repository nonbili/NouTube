import { observable } from '@legendapp/state'
import { settings$ } from './settings'

interface Store {
  url: string
  pageUrl: string
  settingsModalOpen: boolean
  queueModalOpen: boolean
  embedVideoId: string
  libraryModalOpen: boolean
}

export const ui$ = observable<Store>({
  url: '',
  pageUrl: '',
  settingsModalOpen: false,
  queueModalOpen: false,
  embedVideoId: '',
  libraryModalOpen: false,
})

export function updateUrl(url: string) {
  ui$.url.set('')
  ui$.url.set(url)
}
