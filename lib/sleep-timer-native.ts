import NouTubeViewModule from '@/modules/nou-tube-view'
import { isAndroid } from './utils'

type SleepTimerNativeModule = {
  addListener?: (eventName: string, listener: (payload: any) => void) => { remove?: () => void }
  setSleepTimer?: (durationMs: number) => Promise<void>
  clearSleepTimer?: () => Promise<void>
  getSleepTimerRemainingMs?: () => Promise<number | null>
}

function getSleepTimerNativeModule(): SleepTimerNativeModule {
  return NouTubeViewModule as SleepTimerNativeModule
}

export function hasSleepTimerNativeSupport() {
  if (!isAndroid) {
    return false
  }

  const nativeModule = getSleepTimerNativeModule()
  return (
    typeof nativeModule.addListener === 'function' &&
    typeof nativeModule.setSleepTimer === 'function' &&
    typeof nativeModule.clearSleepTimer === 'function' &&
    typeof nativeModule.getSleepTimerRemainingMs === 'function'
  )
}

export async function getNativeSleepTimerRemainingMs() {
  const nativeModule = getSleepTimerNativeModule()
  if (typeof nativeModule.getSleepTimerRemainingMs !== 'function') {
    return null
  }
  return nativeModule.getSleepTimerRemainingMs()
}

export async function setNativeSleepTimer(durationMs: number) {
  const nativeModule = getSleepTimerNativeModule()
  if (typeof nativeModule.setSleepTimer !== 'function') {
    throw new Error('sleep timer native API unavailable')
  }
  return nativeModule.setSleepTimer(durationMs)
}

export async function clearNativeSleepTimer() {
  const nativeModule = getSleepTimerNativeModule()
  if (typeof nativeModule.clearSleepTimer !== 'function') {
    throw new Error('sleep timer native API unavailable')
  }
  return nativeModule.clearSleepTimer()
}

export function addSleepTimerListener(listener: (payload: { remainingMs: number | null; reason: string }) => void) {
  const nativeModule = getSleepTimerNativeModule()
  if (typeof nativeModule.addListener !== 'function') {
    return undefined
  }
  return nativeModule.addListener('sleepTimer', listener)
}
