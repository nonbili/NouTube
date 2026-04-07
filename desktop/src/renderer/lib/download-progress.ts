type ProgressPayload = { line: string; done: boolean; error?: boolean; filePath?: string }
type ProgressListener = (payload: ProgressPayload) => void

let listener: ProgressListener | null = null

export function onDownloadProgress(fn: ProgressListener | null) {
  listener = fn
}

export function downloadProgress(payload: ProgressPayload) {
  listener?.(payload)
}
