import { describe, expect, it } from 'bun:test'
import { blocklist$ } from '@/states/blocklist'
import { settings$ } from '@/states/settings'
import { userStyles$ } from '@/states/user-styles'
import {
  applySettingsBackup,
  createSettingsBackup,
  exportSettingsJson,
  parseSettingsBackup,
  SETTINGS_BACKUP_KIND,
  SETTINGS_BACKUP_VERSION,
} from './settings-transfer'

describe('settings transfer', () => {
  it('exports the current settings, blocklist and user styles', () => {
    settings$.headerPosition.set('bottom')
    blocklist$.addKeyword('spoiler')

    const backup = JSON.parse(exportSettingsJson())
    expect(backup.kind).toBe(SETTINGS_BACKUP_KIND)
    expect(backup.settings.headerPosition).toBe('bottom')
    expect(backup.blocklist.keywords.map((x: { value: string }) => x.value)).toContain('spoiler')
    expect(backup.userStyles.schemaVersion).toBeGreaterThan(0)
  })

  it('rejects files that are not settings backups', () => {
    expect(() => parseSettingsBackup('not json')).toThrow('Not a valid JSON file')
    expect(() => parseSettingsBackup('{"kind":"something-else"}')).toThrow('Not a NouTube settings file')
    expect(() => parseSettingsBackup(JSON.stringify({ kind: SETTINGS_BACKUP_KIND }))).toThrow(
      'Unsupported NouTube settings file version',
    )
    expect(() =>
      parseSettingsBackup(JSON.stringify({ kind: SETTINGS_BACKUP_KIND, version: 2, settings: {} })),
    ).toThrow('created by a newer version')
    expect(() => parseSettingsBackup(JSON.stringify({ kind: SETTINGS_BACKUP_KIND, version: 1 }))).toThrow(
      'Nothing to import',
    )
  })

  it('fills defaults for settings missing from the file', () => {
    const parsed = parseSettingsBackup(
      JSON.stringify({ kind: SETTINGS_BACKUP_KIND, version: SETTINGS_BACKUP_VERSION, settings: { hideShorts: false } }),
    )
    expect(parsed.settings?.hideShorts).toBe(false)
    expect(parsed.settings?.defaultZoom).toBe(100)
    expect(parsed.blocklist).toBeUndefined()
    expect(parsed.userStyles).toBeUndefined()
  })

  it('round-trips a backup through import', () => {
    settings$.defaultZoom.set(125)
    settings$.hideMixPlaylist.set(true)
    const exported = JSON.stringify(createSettingsBackup())

    settings$.defaultZoom.set(100)
    settings$.hideMixPlaylist.set(false)

    const restored = applySettingsBackup(parseSettingsBackup(exported))
    expect(restored).toEqual(['settings', 'blocklist', 'user styles'])
    expect(settings$.defaultZoom.get()).toBe(125)
    expect(settings$.hideMixPlaylist.get()).toBe(true)
  })

  it('keeps custom user styles when importing', () => {
    userStyles$.addCustomStyle({ name: 'Wide', enabled: true, css: 'body{}' })
    const exported = JSON.stringify(createSettingsBackup())
    userStyles$.customStyles.set([])

    applySettingsBackup(parseSettingsBackup(exported))
    expect(userStyles$.customStyles.get().map((x) => x.name)).toContain('Wide')
  })
})
