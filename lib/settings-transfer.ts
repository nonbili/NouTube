import { blocklist$, getBlocklistSnapshot } from '@/states/blocklist'
import { getSettingsSnapshot, settings$, type SettingsSnapshot } from '@/states/settings'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { normalizeBlocklist, type BlocklistSnapshot } from '@/lib/blocklist'
import { normalizeUserStyles, type UserStylesSnapshot } from '@/lib/user-styles'
import { version } from '../package.json'

export const SETTINGS_BACKUP_KIND = 'noutube-settings'
export const SETTINGS_BACKUP_VERSION = 1

export interface SettingsBackup {
  kind: typeof SETTINGS_BACKUP_KIND
  version: typeof SETTINGS_BACKUP_VERSION
  appVersion: string
  exportedAt: string
  settings: SettingsSnapshot
  blocklist: BlocklistSnapshot
  userStyles: UserStylesSnapshot
}

export const createSettingsBackup = (): SettingsBackup => ({
  kind: SETTINGS_BACKUP_KIND,
  version: SETTINGS_BACKUP_VERSION,
  appVersion: version,
  exportedAt: new Date().toISOString(),
  settings: getSettingsSnapshot(),
  blocklist: getBlocklistSnapshot(),
  userStyles: getUserStylesSnapshot(),
})

export const exportSettingsJson = () => JSON.stringify(createSettingsBackup(), null, 2)

export const settingsBackupFilename = () => `NouTube_settings_${Date.now()}.json`

/**
 * Parse a settings backup file. Unknown or missing sections are dropped, every
 * kept section is normalized so a hand-edited or older file can't poison state.
 */
export const parseSettingsBackup = (
  text: string,
): {
  settings?: SettingsSnapshot
  blocklist?: BlocklistSnapshot
  userStyles?: UserStylesSnapshot
} => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Not a valid JSON file')
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Not a NouTube settings file')
  }

  const backup = data as Partial<SettingsBackup>
  if (backup.kind !== SETTINGS_BACKUP_KIND) {
    throw new Error('Not a NouTube settings file')
  }
  if (backup.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error(
      typeof backup.version === 'number' && backup.version > SETTINGS_BACKUP_VERSION
        ? 'This settings file was created by a newer version of NouTube'
        : 'Unsupported NouTube settings file version',
    )
  }

  const isObject = (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

  const result: ReturnType<typeof parseSettingsBackup> = {}
  if (isObject(backup.settings)) {
    result.settings = getSettingsSnapshot(backup.settings)
  }
  if (isObject(backup.blocklist)) {
    result.blocklist = normalizeBlocklist(backup.blocklist)
  }
  if (isObject(backup.userStyles)) {
    result.userStyles = normalizeUserStyles(backup.userStyles)
  }

  if (!result.settings && !result.blocklist && !result.userStyles) {
    throw new Error('Nothing to import in this file')
  }

  return result
}

/** Apply a parsed backup. Returns the names of the sections that were restored. */
export const applySettingsBackup = (backup: ReturnType<typeof parseSettingsBackup>) => {
  const restored: string[] = []

  if (backup.settings) {
    settings$.assign(backup.settings)
    restored.push('settings')
  }
  if (backup.blocklist) {
    blocklist$.assign(backup.blocklist)
    restored.push('blocklist')
  }
  if (backup.userStyles) {
    userStyles$.assign(backup.userStyles)
    restored.push('user styles')
  }

  return restored
}

export const importSettingsJson = (text: string) => applySettingsBackup(parseSettingsBackup(text))
