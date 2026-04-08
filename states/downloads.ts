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
