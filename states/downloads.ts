import { observable } from '@legendapp/state'

export type DownloadPhase = 'downloading' | 'done' | 'error'

export interface DownloadState {
  url: string
  phase: DownloadPhase
  progressLine: string
  errorMsg: string
  savedPath: string
}

export const downloads$ = observable<Record<string, DownloadState>>({})
