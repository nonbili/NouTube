import { useEffect, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { sleepTimer$ } from '@/states/sleep-timer'

export const SLEEP_TIMER_MINUTES_PRESETS = [15, 30, 45, 60] as const
export const SLEEP_TIMER_MIN_MINUTES = 1
export const SLEEP_TIMER_MAX_MINUTES = 1440

export function parseSleepTimerMinutes(input: string) {
  const value = input.trim()
  if (!value) {
    return { ok: false as const, reason: 'empty' as const }
  }
  if (!/^\d+$/.test(value)) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  const minutes = Number(value)
  if (!Number.isInteger(minutes) || minutes < SLEEP_TIMER_MIN_MINUTES || minutes > SLEEP_TIMER_MAX_MINUTES) {
    return { ok: false as const, reason: 'range' as const }
  }

  return { ok: true as const, minutes }
}

export function getSleepTimerRemainingMs(expiresAtMs: number | null, now = Date.now()) {
  if (!expiresAtMs) {
    return null
  }
  return Math.max(0, expiresAtMs - now)
}

export function isSleepTimerActive(expiresAtMs: number | null, now = Date.now()) {
  const remainingMs = getSleepTimerRemainingMs(expiresAtMs, now)
  return remainingMs != null && remainingMs > 0
}

export function formatSleepTimerRemaining(remainingMs: number | null) {
  if (remainingMs == null) {
    return '0m'
  }

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

export function useSleepTimerNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) {
      return
    }

    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [enabled])

  return now
}

export function useSleepTimerStatus(enabled: boolean) {
  const expiresAtMs = useValue(sleepTimer$.expiresAtMs)
  const now = useSleepTimerNow(enabled && expiresAtMs != null)
  const remainingMs = getSleepTimerRemainingMs(expiresAtMs, now)
  const active = remainingMs != null && remainingMs > 0

  return {
    active,
    expiresAtMs,
    remainingMs: active ? remainingMs : null,
  }
}
