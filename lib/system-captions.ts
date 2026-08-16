import { Linking } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { normalizeSystemCaptionStyle, type SystemCaptionStyle } from './captions'
import { isAndroid } from './utils'

type SystemCaptionsNativeModule = {
  addListener?: (eventName: string, listener: (payload: any) => void) => { remove?: () => void }
  getSystemCaptionStyle?: () => unknown
}

const getNativeModule = () => NouTubeViewModule as SystemCaptionsNativeModule

export function hasSystemCaptionStyleSupport() {
  return isAndroid && typeof getNativeModule().getSystemCaptionStyle === 'function'
}

export function getSystemCaptionStyle(): SystemCaptionStyle | null {
  if (!hasSystemCaptionStyleSupport()) {
    return null
  }
  try {
    return normalizeSystemCaptionStyle(getNativeModule().getSystemCaptionStyle!())
  } catch {
    return null
  }
}

export function addSystemCaptionStyleListener(listener: (style: SystemCaptionStyle | null) => void) {
  const nativeModule = getNativeModule()
  if (!isAndroid || typeof nativeModule.addListener !== 'function') {
    return undefined
  }
  return nativeModule.addListener('captionStyle', (payload) => listener(normalizeSystemCaptionStyle(payload)))
}

export function openSystemCaptionSettings() {
  if (!isAndroid) {
    return
  }
  // Android exposes the caption preferences screen as a settings intent action.
  void Linking.sendIntent?.('android.settings.CAPTIONING_SETTINGS')
}
