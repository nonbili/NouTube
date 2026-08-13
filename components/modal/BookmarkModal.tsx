import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { FlatList, Pressable, TextInput, View } from 'react-native'
import { useMemo, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { Bookmark, bookmarks$ } from '@/states/bookmarks'
import { Folder, folders$, newFolder } from '@/states/folders'
import { NouButton } from '../button/NouButton'
import { sortBy } from 'es-toolkit'
import { t } from 'i18next'
import { getPageType } from '@/lib/page'
import { feeds$ } from '@/states/feeds'
import { showConfirm } from '@/lib/confirm'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { clsx, nIf } from '@/lib/utils'

const NO_FOLDER_ID = '__no_folder__'
const NEW_FOLDER_ID = '__new__'

export const BookmarkModal = () => {
  const bookmark = useValue(ui$.bookmarkModalBookmark)
  const bookmarkModalMode = useValue(ui$.bookmarkModalMode)

  if (!bookmark) {
    return null
  }

  return <BookmarkModalContent key={bookmark.id} bookmark={bookmark} bookmarkModalMode={bookmarkModalMode} />
}

const BookmarkModalContent: React.FC<{
  bookmark: Bookmark
  bookmarkModalMode: 'default' | 'feed'
}> = ({ bookmark, bookmarkModalMode }) => {
  const onClose = () => {
    ui$.bookmarkModalBookmark.set(undefined)
    ui$.bookmarkModalMode.set('default')
  }
  const [title, setTitle] = useState(bookmark.title)
  const folders = useValue(folders$.folders)
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const [draftBookmark, setDraftBookmark] = useState(bookmark)

  const folderTab = useMemo(() => {
    const pageType = getPageType(draftBookmark.url)
    if (pageType?.home === 'yt-music') {
      if (pageType.type === 'channel') {
        return 'm-channel'
      }
      if (pageType.type === 'playlist') {
        return 'm-playlist'
      }
      return 'm-watch'
    }
    if (pageType?.type === 'channel') {
      return 'channel'
    }
    if (pageType?.type === 'playlist') {
      return 'playlist'
    }
    return 'watch'
  }, [draftBookmark])

  // No useMemo: legend-state mutates the folders array in place, so its
  // reference stays stable and a memo would miss newly created folders.
  const filteredFolders = [
    newFolder(folderTab, { id: NO_FOLDER_ID, name: t('modals.noFolder') }),
    ...sortBy(
      folders.filter((x) => !x.json.deleted && x.json.tab === folderTab),
      ['name'],
    ),
    newFolder(folderTab, { id: NEW_FOLDER_ID, name: t('feeds.newFolder') }),
  ]

  const folder = folders.find((x) => x.id === draftBookmark.json.folder)
  const selectedFolderId = folder?.id || NO_FOLDER_ID

  const onChangeFolder = (folder: Folder) => {
    if (folder.id === NEW_FOLDER_ID) {
      ui$.folderModalFolder.set(newFolder(folderTab))
      return
    }
    setDraftBookmark({
      ...draftBookmark,
      json: {
        ...draftBookmark.json,
        folder: folder.id === NO_FOLDER_ID ? undefined : folder.id,
      },
    })
    setFolderPickerShown(false)
  }

  const onSubmit = () => {
    if (!title) {
      return
    }
    bookmarks$.saveBookmark({ ...draftBookmark, title })
    onClose()
  }

  const onRemove = () => {
    if (bookmarkModalMode === 'feed') {
      showConfirm(
        t('feeds.removeTitle', { title: bookmark.title }),
        t('feeds.removeMessage'),
        () => {
          bookmarks$.toggleBookmark(bookmark)
          if (bookmark.json.id) {
            feeds$.removeChannel(bookmark.json.id)
          }
          onClose()
        },
      )
      return
    }

    bookmarks$.toggleBookmark(bookmark)
    onClose()
  }

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-6">
        <NouText className="text-xl font-semibold mb-5">
          {bookmarkModalMode === 'feed' ? t('feeds.editFeed') : t('modals.editBookmark')}
        </NouText>
        <NouText className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">{t('modals.title')}</NouText>
        <TextInput
          className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white"
          value={title}
          onChangeText={setTitle}
          placeholder="Later"
          placeholderTextColor={gray.gray11}
        />
        <NouText className="mt-2 text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={2} ellipsizeMode="middle">
          {draftBookmark.url}
        </NouText>

        <NouText className="mt-5 mb-2 font-semibold text-zinc-700 dark:text-zinc-300">{t('modals.folder')}</NouText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFolderPickerShown(!folderPickerShown)}
          className="flex-row items-center gap-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800"
        >
          <MaterialIcons name="folder" size={22} color="#a1a1aa" />
          <NouText className="flex-1">{folder?.name || t('modals.noFolder')}</NouText>
          <MaterialIcons name={folderPickerShown ? 'expand-less' : 'expand-more'} size={24} color="#a1a1aa" />
        </Pressable>
        {folderPickerShown ? (
          <FlatList
            className="mt-2 max-h-[220px] overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            data={filteredFolders}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View className="h-px bg-zinc-200 dark:bg-zinc-800" />}
            renderItem={({ item }) => {
              const selected = item.id === selectedFolderId
              return (
                <Pressable
                  onPress={() => onChangeFolder(item)}
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
        ) : null}
        <View className="flex-row items-center justify-between mt-8">
          <NouButton variant="outline" size="2" textClassName="text-red-600 dark:text-red-400" onPress={onRemove}>
            {bookmarkModalMode === 'feed' ? t('buttons.unsubscribe') : t('buttons.remove')}
          </NouButton>
          <NouButton size="2" onPress={onSubmit}>{t('buttons.save')}</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
