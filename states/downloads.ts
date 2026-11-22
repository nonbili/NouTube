import { observable } from '@legendapp/state'

export type DownloadPhase = 'downloading' | 'done' | 'error'

export interface DownloadState {
  url: string
  title: string
  phase: DownloadPhase
  progress: number
  progressLine: string
  errorMsg: string
  savedPath: string
}

export const downloads$ = observable<Record<string, DownloadState>>({})

export function failDownload(url: string, message: string) {
  // A progress event may have already finished the download or reported a
  // more useful error before the bridge promise rejected.
  if (downloads$[url].phase.peek() !== 'downloading') return
  downloads$[url].assign({ phase: 'error', errorMsg: message })
}
