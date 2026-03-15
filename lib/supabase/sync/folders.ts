import { syncState, when } from '@legendapp/state'
import { Folder, folders$ } from '@/states/folders'
import { ResourceSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { BaseSyncer } from './base'

class FoldersSyncer extends BaseSyncer<Folder> {
  NAME = 'folders'
  TABLE_NAME = 'nou_folders'
  COLUMNS = 'id,name,json,created_at,updated_at'
  pushWhenRemoteMissing = false

  isPersistLoaded = () => when(syncState(folders$).isPersistLoaded)

  getStore() {
    const { folders, updatedAt } = folders$.get()
    return { items: folders, updatedAt }
  }

  setStore({ items, updatedAt }: { items: Folder[]; updatedAt: Date }) {
    folders$.assign({ folders: items, updatedAt })
  }

  getMeta() {
    return syncMeta$.folders.get()
  }

  setMeta(meta: Partial<ResourceSyncMeta<Folder[]>>) {
    syncMeta$.folders.assign(meta)
  }

  hasMeaningfulLocalValue(items: Folder[]) {
    return items.some((item) => !item.json.deleted)
  }
}

export const foldersSyncer = new FoldersSyncer()
