import { syncState, when } from '@legendapp/state'
import { getSettingsSnapshot, normalizeSettings, settings$, type SettingsSnapshot } from '@/states/settings'
import { ResourceSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { DocumentSyncer } from './document-base'
import { mergeKeys } from './merge'
import { mergeToolbarButtonOrder } from '@/lib/toolbar-buttons'

class SettingsSyncer extends DocumentSyncer<SettingsSnapshot> {
  NAME = 'settings'
  TABLE_NAME = 'nou_settings'
  pushWhenRemoteMissing = true

  isPersistLoaded = () =>
    when(() => syncState(settings$).isPersistLoaded.get() && syncState(syncMeta$).isPersistLoaded.get())

  getValue() {
    return getSettingsSnapshot()
  }

  setValue(value: SettingsSnapshot, replace = false) {
    // A document written by a version of the app that predates the toolbar settings lacks them:
    // keep this device's rather than resetting them, unless another account's settings replace these.
    const local = replace ? undefined : settings$.peek()
    settings$.assign(
      normalizeSettings({
        ...value,
        toolbarButtonOrder: local
          ? mergeToolbarButtonOrder(value.toolbarButtonOrder ?? local.toolbarButtonOrder, local.toolbarButtonOrder)
          : value.toolbarButtonOrder,
        toolbarMenuButtons: value.toolbarMenuButtons ?? local?.toolbarMenuButtons,
        showQueueButtonInHeader: value.showQueueButtonInHeader ?? local?.showQueueButtonInHeader,
        showScriptsButtonInHeader: value.showScriptsButtonInHeader ?? local?.showScriptsButtonInHeader,
      }),
    )
  }

  // Each setting on its own; one both devices changed is the other device's.
  merge(base: SettingsSnapshot | undefined, local: SettingsSnapshot, remote: SettingsSnapshot) {
    return mergeKeys(base, local, remote)
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
