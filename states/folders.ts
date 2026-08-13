import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import { bookmarks$ } from './bookmarks'
import { showUndoToast } from './undo-toast'
import { t } from 'i18next'

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
  addFolder: (folder: Folder) => void
  saveFolder: (folder: Folder) => void
  removeFolder: (folder: Folder) => void
  restoreFolder: (folder: Folder) => void
  importFolders: (folders: Folder[]) => void
  getOrCreateFolder: (tab: string, name: string) => Folder
  setUpdatedTime: () => void
}

const getFolderIndex = (folder: Folder) => folders$.folders.findIndex((x) => x.id.get() == folder.id)

export const folders$ = observable<Store>({
  folders: [],
  updatedAt: new Date(0),
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
  restoreFolder: (folder) => {
    const index = getFolderIndex(folder)
    if (index === -1) {
      folders$.folders.unshift({ ...folder, json: { ...folder.json, deleted: false }, updated_at: new Date() })
    } else {
      const json = folders$.folders[index].json.get()
      folders$.folders[index].json.set({ ...json, deleted: false })
      folders$.folders[index].updated_at.set(new Date())
    }
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
  getOrCreateFolder(tab: string, name: string): Folder {
    let folder = folders$.folders.get().find((x) => x.json.tab == tab && x.name == name)
    if (!folder) {
      folder = newFolder(tab, { name })
    }
    folders$.saveFolder(folder)
    return folder
  },
  setUpdatedTime() {
    folders$.updatedAt.set(new Date())
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
  const bookmarkIds = bookmarks$.bookmarks
    .get()
    .filter((bookmark) => bookmark.json.folder === folder.id && !bookmark.json.deleted)
    .map((bookmark) => bookmark.id)

  folders$.removeFolder(folder)
  bookmarks$.removeByFolder(folder.id)
  showUndoToast(t('folders.removed', { name: folder.name }), () => {
    folders$.restoreFolder(folder)
    bookmarks$.restoreByIds(bookmarkIds)
  })
}
