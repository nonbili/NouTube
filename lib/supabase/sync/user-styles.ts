import { syncState, when } from '@legendapp/state'
import { normalizeUserStyles, type UserStylesSnapshot } from '@/lib/user-styles'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { ResourceSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { DocumentSyncer } from './document-base'

class UserStylesSyncer extends DocumentSyncer<UserStylesSnapshot> {
  NAME = 'user-styles'
  TABLE_NAME = 'nou_user_styles'
  pushWhenRemoteMissing = true

  isPersistLoaded = () =>
    when(() => syncState(userStyles$).isPersistLoaded.get() && syncState(syncMeta$).isPersistLoaded.get())

  getValue() {
    return getUserStylesSnapshot()
  }

  setValue(value: UserStylesSnapshot) {
    userStyles$.assign(normalizeUserStyles(value))
  }

  hasMeaningfulLocalValue() {
    return true
  }

  getMeta() {
    return syncMeta$.userStyles.get()
  }

  setMeta(meta: Partial<ResourceSyncMeta<UserStylesSnapshot>>) {
    syncMeta$.userStyles.assign(meta)
  }
}

export const userStylesSyncer = new UserStylesSyncer()
