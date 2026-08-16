import { useValue } from '@legendapp/state/react'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { sortBy } from 'es-toolkit'
import { t } from 'i18next'
import { FlatList, Pressable, View } from 'react-native'
import { useEffect, useRef } from 'react'
import { getBookmarkFolderTab } from '@/lib/bookmark-folders'
import { showToast } from '@/lib/toast'
import { clsx, nIf } from '@/lib/utils'
import { bookmarks$ } from '@/states/bookmarks'
import { folders$, newFolder } from '@/states/folders'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { BaseCenterModal } from './BaseCenterModal'

const NO_FOLDER_ID = '__no_folder__'
const NEW_FOLDER_ID = '__new__'

export const MoveBookmarkModal = () => {
  const bookmark = useValue(ui$.moveBookmarkModalBookmark)
  const folders = useValue(folders$.folders)
  const folderModalFolder = useValue(ui$.folderModalFolder)
  const pendingFolderIdRef = useRef<string | undefined>(undefined)
  const onClose = () => ui$.moveBookmarkModalBookmark.set(undefined)

  useEffect(() => {
    if (!bookmark) {
      pendingFolderIdRef.current = undefined
      return
    }

    const pendingFolderId = pendingFolderIdRef.current
    if (folderModalFolder || !pendingFolderId) {
      return
    }

    pendingFolderIdRef.current = undefined
    const folder = folders$.folders.get().find((item) => item.id === pendingFolderId && !item.json.deleted)
    if (!folder || !bookmarks$.moveToFolder(bookmark.id, folder.id)) {
      onClose()
      return
    }

    showToast(folder.id === NO_FOLDER_ID ? t('bookmarks.movedToRoot') : t('bookmarks.moved', { folder: folder.name }))
    onClose()
  }, [bookmark, folderModalFolder])

  if (!bookmark) {
    return null
  }

  const folderTab = getBookmarkFolderTab(bookmark.url)
  const availableFolders = sortBy(
    folders.filter((folder) => !folder.json.deleted && folder.json.tab === folderTab),
    ['name'],
  )
  const items = [
    { id: NO_FOLDER_ID, name: t('modals.noFolder') },
    ...availableFolders.map((folder) => ({ id: folder.id, name: folder.name })),
    { id: NEW_FOLDER_ID, name: t('feeds.newFolder') },
  ]
  const selectedFolderId = bookmark.json.folder || NO_FOLDER_ID

  const moveTo = (folder: (typeof items)[number]) => {
    if (folder.id === NEW_FOLDER_ID) {
      const folderDraft = newFolder(folderTab)
      pendingFolderIdRef.current = folderDraft.id
      ui$.folderModalFolder.set(folderDraft)
      return
    }
    if (!bookmarks$.moveToFolder(bookmark.id, folder.id === NO_FOLDER_ID ? undefined : folder.id)) {
      onClose()
      return
    }
    showToast(t('bookmarks.moved', { folder: folder.name }))
    onClose()
  }

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="mb-4 text-lg font-semibold">{t('menus.moveTo')}</NouText>
        <View className="max-h-[360px] overflow-hidden rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View className="h-px bg-zinc-200 dark:bg-zinc-800" />}
            renderItem={({ item }) => {
              const selected = item.id === selectedFolderId
              return (
                <Pressable
                  onPress={() => moveTo(item)}
                  className={clsx(
                    'flex-row items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800',
                    selected && 'bg-indigo-50 dark:bg-zinc-800',
                  )}
                >
                  <MaterialIcons name={item.id === NEW_FOLDER_ID ? 'create-new-folder' : 'folder'} size={22} color="#a1a1aa" />
                  <NouText className={clsx('flex-1', selected && 'font-semibold')}>{item.name}</NouText>
                  {nIf(selected, <MaterialIcons name="check" size={22} color="#6366f1" />)}
                </Pressable>
              )
            }}
          />
        </View>
      </View>
    </BaseCenterModal>
  )
}
