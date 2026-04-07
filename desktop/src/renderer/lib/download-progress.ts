type ProgressPayload = { url: string; line: string; done: boolean; error?: boolean; filePath?: string }
type ProgressListener = (payload: ProgressPayload) => void

const listeners = new Set<ProgressListener>()

export function onDownloadProgress(fn: ProgressListener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function downloadProgress(payload: ProgressPayload) {
  listeners.forEach((l) => l(payload))
}
