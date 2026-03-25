import { describe, expect, it } from 'bun:test'
import {
  formatSleepTimerRemaining,
  getSleepTimerRemainingMs,
  isSleepTimerActive,
  parseSleepTimerMinutes,
} from './sleep-timer'

describe('sleep timer helpers', () => {
  it('parses valid whole minutes', () => {
    expect(parseSleepTimerMinutes('45')).toEqual({ ok: true, minutes: 45 })
  })

  it('rejects empty or non-numeric input', () => {
    expect(parseSleepTimerMinutes('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseSleepTimerMinutes('1.5')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseSleepTimerMinutes('abc')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects minutes outside the allowed range', () => {
    expect(parseSleepTimerMinutes('0')).toEqual({ ok: false, reason: 'range' })
    expect(parseSleepTimerMinutes('1441')).toEqual({ ok: false, reason: 'range' })
  })

  it('computes active remaining time from an expiry deadline', () => {
    expect(getSleepTimerRemainingMs(10_000, 8_000)).toBe(2_000)
    expect(isSleepTimerActive(10_000, 8_000)).toBe(true)
  })

  it('treats expired deadlines as inactive', () => {
    expect(getSleepTimerRemainingMs(10_000, 12_000)).toBe(0)
    expect(isSleepTimerActive(10_000, 12_000)).toBe(false)
  })

  it('formats remaining time compactly', () => {
    expect(formatSleepTimerRemaining(59_000)).toBe('59s')
    expect(formatSleepTimerRemaining(5 * 60_000)).toBe('5m')
    expect(formatSleepTimerRemaining((2 * 3600 + 5 * 60) * 1000)).toBe('2h 5m')
  })
})
