import { syncState, when } from '@legendapp/state'
import { Folder, folders$ } from '@/states/folders'
import { BaseSyncer } from './base'

class FoldersSyncer extends BaseSyncer<Folder> {
  NAME = 'folders'
  TABLE_NAME = 'nou_folders'
  COLUMNS = 'id,name,json,created_at,updated_at'
  SYNC_STATE_FIELD = 'folders_updated_at'

  isPersistLoaded = () => when(syncState(folders$).isPersistLoaded)

  getStore() {
    const { folders, updatedAt, syncedAt } = folders$.get()
    return { items: folders, updatedAt, syncedAt }
  }

  setStore({ items, updatedAt }: { items: Folder[]; updatedAt: Date }) {
    folders$.assign({ folders: items, updatedAt })
  }

  importItems(items: Folder[]) {
    folders$.importFolders(items)
  }

  setSyncedTime() {
    folders$.setSyncedTime()
  }
}

export const foldersSyncer = new FoldersSyncer()
