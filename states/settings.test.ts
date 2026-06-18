import { describe, expect, it } from 'bun:test'
import { getSettingsSnapshot, normalizeSettings, type SettingsSnapshot } from './settings'

const normalizePartialSettings = () => normalizeSettings<Partial<SettingsSnapshot>>({})

describe('settings', () => {
  it('defaults original video title setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showOriginalVideoTitle).toBe(false)
  })

  it('defaults show dislikes setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showDislikes).toBe(false)
  })

  it('defaults desktop sidebar autohide setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).autoHideSidebar).toBe(false)
  })

  it('defaults pull to refresh setting on in snapshots', () => {
    expect(getSettingsSnapshot({}).pullToRefreshEnabled).toBe(true)
  })

  it('defaults text zoom to 100 in snapshots', () => {
    expect(getSettingsSnapshot({}).defaultZoom).toBe(100)
  })

  it('normalizes missing original video title setting to false', () => {
    const settings = normalizePartialSettings()
    expect(settings?.showOriginalVideoTitle).toBe(false)
  })

  it('normalizes missing show dislikes setting to false', () => {
    const settings = normalizePartialSettings()
    expect(settings?.showDislikes).toBe(false)
  })

  it('normalizes missing desktop sidebar autohide setting to false', () => {
    const settings = normalizePartialSettings()
    expect(settings?.autoHideSidebar).toBe(false)
  })

  it('normalizes missing pull to refresh setting to true', () => {
    const settings = normalizePartialSettings()
    expect(settings?.pullToRefreshEnabled).toBe(true)
  })

  it('normalizes missing text zoom to 100', () => {
    const settings = normalizePartialSettings()
    expect(settings?.defaultZoom).toBe(100)
  })
})
