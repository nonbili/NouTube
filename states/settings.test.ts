import { describe, expect, it } from 'bun:test'
import { getSettingsSnapshot, normalizeSettings } from './settings'

describe('settings', () => {
  it('defaults original video title setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showOriginalVideoTitle).toBe(false)
  })

  it('defaults show dislikes setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showDislikes).toBe(false)
  })

  it('normalizes missing original video title setting to false', () => {
    const settings = normalizeSettings({})
    expect(settings?.showOriginalVideoTitle).toBe(false)
  })

  it('normalizes missing show dislikes setting to false', () => {
    const settings = normalizeSettings({})
    expect(settings?.showDislikes).toBe(false)
  })
})
