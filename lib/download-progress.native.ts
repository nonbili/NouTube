import NouTubeViewModule from '@/modules/nou-tube-view'
import { downloadProgress, type ProgressPayload } from './download-progress-base'

type DownloadProgressModule = {
  addListener?: (eventName: string, listener: (payload: ProgressPayload) => void) => { remove?: () => void }
}

const nativeModule = NouTubeViewModule as DownloadProgressModule

if (typeof nativeModule.addListener === 'function') {
  nativeModule.addListener('downloadProgress', (payload) => {
    downloadProgress(payload)
  })
}

export * from './download-progress-base'
