import { describe, expect, it } from 'bun:test'
import { getSettingsSnapshot, normalizeSettings } from './settings'

describe('settings', () => {
  it('defaults original video title setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showOriginalVideoTitle).toBe(false)
  })

  it('normalizes missing original video title setting to false', () => {
    const settings = normalizeSettings({})
    expect(settings?.showOriginalVideoTitle).toBe(false)
  })
})
