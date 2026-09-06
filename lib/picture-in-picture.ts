import NouTubeViewModule from '@/modules/nou-tube-view'
import { isAndroid } from './utils'

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
