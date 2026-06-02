import { syncState, when } from '@legendapp/state'
import { getSettingsSnapshot, normalizeSettings, settings$, type SettingsSnapshot } from '@/states/settings'
import { ResourceSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { DocumentSyncer } from './document-base'

class SettingsSyncer extends DocumentSyncer<SettingsSnapshot> {
  NAME = 'settings'
  TABLE_NAME = 'nou_settings'
  pushWhenRemoteMissing = true

  isPersistLoaded = () =>
    when(() => syncState(settings$).isPersistLoaded.get() && syncState(syncMeta$).isPersistLoaded.get())

  getValue() {
    return getSettingsSnapshot()
  }

  setValue(value: SettingsSnapshot) {
    settings$.assign(normalizeSettings(value))
  }

  hasMeaningfulLocalValue() {
    return true
  }

  getMeta() {
    return syncMeta$.settings.get()
  }

  setMeta(meta: Partial<ResourceSyncMeta<SettingsSnapshot>>) {
    syncMeta$.settings.assign(meta)
  }
}

export const settingsSyncer = new SettingsSyncer()
