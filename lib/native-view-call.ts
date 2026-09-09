/* Expo creates a native view at the end of the commit that mounted it, so a
 * view function called from an effect in that same commit reaches the module
 * before the view is in its registry: it comes back as a rejected ViewNotFound
 * having done nothing at all. The split watch view runs into this every time it
 * is turned on while a video is open -- the player webview is mounted and
 * handed the video in one go -- so those calls are retried until the view is
 * there, and dropped as soon as they stop being the call the app is waiting
 * for. */
const RETRY_MS = 50
const RETRY_LIMIT = 40

export function retryNativeViewCall(call: () => any, isStale: () => boolean, attempt = 0) {
  // Checked before every attempt rather than only when one fails: the video can
  // be closed or replaced while a retry waits out its timer, and running the
  // call anyway would pull a dead video back into the player -- or hand the
  // media session to the wrong webview -- the moment the native view comes up.
  if (isStale()) {
    return
  }
  let pending: any
  try {
    pending = call()
  } catch {
    pending = Promise.reject()
  }
  pending?.catch?.(() => {
    if (attempt >= RETRY_LIMIT) {
      return
    }
    setTimeout(() => retryNativeViewCall(call, isStale, attempt + 1), RETRY_MS)
  })
}
