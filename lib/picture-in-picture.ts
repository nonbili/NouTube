import NouTubeViewModule from '@/modules/nou-tube-view'
import { isAndroid, isIos } from './utils'
import { showToast } from './toast'

type PictureInPictureNativeModule = {
  addListener?: (eventName: string, listener: (payload: any) => void) => { remove?: () => void }
}

/**
 * Fires when Android pins the app to a floating window and when it lets go.
 * The video itself is shrunk by the page (content/picture-in-picture.ts); this
 * is only how the app chrome learns to get out of its way.
 */
export function addPictureInPictureListener(listener: (active: boolean) => void) {
  const nativeModule = NouTubeViewModule as PictureInPictureNativeModule
  if (!isAndroid || typeof nativeModule.addListener !== 'function') {
    return undefined
  }
  return nativeModule.addListener('pictureInPicture', (payload) => listener(Boolean(payload?.active)))
}

type PictureInPictureView = {
  togglePictureInPicture?: () => Promise<string>
}

/**
 * iOS enters Picture-in-Picture through WebKit's own presentation API, driven
 * from the header button: the request only comes back with a picture while the
 * app is still frontmost, so the app cannot wait for the user to leave.
 */
export async function togglePictureInPicture(webview: PictureInPictureView | undefined | null) {
  if (!isIos) return
  try {
    const status = await webview?.togglePictureInPicture?.()
    if (status === 'no-video' || status === 'unsupported') {
      showToast('Picture-in-Picture is not available for this video')
    }
  } catch (error) {
    console.error(error)
    showToast('Picture-in-Picture is not available for this video')
  }
}
