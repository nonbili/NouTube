import { Observable, observable, syncState, when } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import { watchlist$ } from './watchlist'
import { showToast } from '@/lib/toast'
import { showConfirm } from '@/lib/confirm'
import { bookmarks$ } from './bookmarks'

export interface Folder {
  id: string
  name: string
  created_at: Date
  updated_at: Date
  json: {
    tab: string
    deleted?: boolean
  }
}

interface Store {
  folders: Folder[]
  updatedAt: Date
  syncedAt: Date | undefined
  addFolder: (folder: Folder) => void
  saveFolder: (folder: Folder) => void
  removeFolder: (folder: Folder) => void
  importFolders: (folders: Folder[]) => void
  setUpdatedTime: () => void
  setSyncedTime: () => void
}

const getFolderIndex = (folder: Folder) => folders$.folders.findIndex((x) => x.id.get() == folder.id)

export const folders$ = observable<Store>({
  folders: [],
  updatedAt: new Date(1970),
  syncedAt: undefined,
  addFolder: (folder) => {
    folders$.folders.unshift(folder)
    folders$.setUpdatedTime()
  },
  saveFolder: (folder) => {
    const index = getFolderIndex(folder)
    if (index != -1) {
      folder.updated_at = new Date()
      folders$.folders[index].set(folder)
    } else {
      folders$.folders.unshift(folder)
    }
    folders$.setUpdatedTime()
  },
  removeFolder: (folder) => {
    const index = getFolderIndex(folder)
    folders$.folders[index].json.deleted.set(true)
    folders$.folders[index].updated_at.set(new Date())
    folders$.setUpdatedTime()
  },
  importFolders: (folders) => {
    if (!folders.length) {
      return 0
    }
    const folderIds = new Set(folders$.folders.get().map((x) => x.id))
    const xs = folders.filter((x) => !folderIds.has(x.id))
    folders$.folders.push(...xs)
    folders$.setUpdatedTime()
    return xs.length
  },
  setUpdatedTime() {
    folders$.updatedAt.set(new Date())
  },
  setSyncedTime() {
    folders$.syncedAt.set(new Date())
  },
})

if (isWeb) {
  syncObservable(folders$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'folders',
      },
    },
  })
} else {
  syncObservable(folders$, {
    persist: {
      name: 'folders',
      plugin: ObservablePersistMMKV,
    },
  })
}

export function newFolder(tab: string, folder?: Partial<Folder>): Folder {
  return {
    id: genId(),
    name: '',
    json: { tab },
    created_at: new Date(),
    updated_at: new Date(),
    ...folder,
  }
}

export function removeFolder(folder: Folder) {
  showConfirm(`Delete ${folder.name}`, 'All items in the folder will be deleted.', () => {
    folders$.removeFolder(folder)
    bookmarks$.removeByFolder(folder.id)
    showToast(`Folder ${folder.name} deleted`)
  })
}
