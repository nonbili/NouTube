import { syncState, when } from '@legendapp/state'
import { Folder, folders$ } from '@/states/folders'
import { RowSyncMeta, syncMeta$ } from '@/states/sync-meta'
import { RowSyncer } from './base'

class FoldersSyncer extends RowSyncer<Folder> {
  NAME = 'folders'
  TABLE_NAME = 'nou_folders'
  COLUMNS = 'id,name,json,created_at,updated_at'

  isPersistLoaded = () =>
    when(() => syncState(folders$).isPersistLoaded.get() && syncState(syncMeta$).isPersistLoaded.get())

  getRows() {
    return folders$.folders.peek()
  }

  setRows(rows: Folder[]) {
    folders$.assign({ folders: rows, updatedAt: new Date() })
  }

  getMeta() {
    return syncMeta$.folders.peek()
  }

  setMeta(meta: Partial<RowSyncMeta>) {
    syncMeta$.folders.assign(meta)
  }
}

export const foldersSyncer = new FoldersSyncer()
