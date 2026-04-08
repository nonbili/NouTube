export type ProgressPayload = {
  url: string
  line: string
  done: boolean
  error?: boolean
  filePath?: string
  progress?: number
  eta?: number
}

type ProgressListener = (payload: ProgressPayload) => void

const listeners = new Set<ProgressListener>()

export function onDownloadProgress(fn: ProgressListener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function downloadProgress(payload: ProgressPayload) {
  listeners.forEach((listener) => listener(payload))
}
