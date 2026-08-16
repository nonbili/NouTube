import NouTubeViewModule from '@/modules/nou-tube-view'
import { isAndroid } from './utils'

type DesktopModeNativeModule = {
  addListener?: (eventName: string, listener: (payload: any) => void) => { remove?: () => void }
  isSystemDesktopMode?: () => unknown
}

const getNativeModule = () => NouTubeViewModule as DesktopModeNativeModule

/**
 * Whether Android is showing the app on a desktop-class screen (an external
 * monitor or Samsung DeX). Unrelated to the desktop *site* settings -- it only
 * seeds them, see useDesktopMode.
 */
export function getSystemDesktopMode() {
  if (!isAndroid || typeof getNativeModule().isSystemDesktopMode !== 'function') {
    return false
  }
  try {
    return Boolean(getNativeModule().isSystemDesktopMode!())
  } catch {
    return false
  }
}

export function addSystemDesktopModeListener(listener: (desktopMode: boolean) => void) {
  const nativeModule = getNativeModule()
  if (!isAndroid || typeof nativeModule.addListener !== 'function') {
    return undefined
  }
  return nativeModule.addListener('desktopMode', (payload) => listener(Boolean(payload?.desktopMode)))
}
