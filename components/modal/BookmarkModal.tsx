import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { FlatList, TextInput, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { bookmarks$ } from '@/states/bookmarks'
import { Folder, folders$, newFolder } from '@/states/folders'
import { NouButton } from '../button/NouButton'
import { sortBy } from 'es-toolkit'
import { FolderItem } from '../folder/FolderItem'
import { t } from 'i18next'
import { getPageType } from '@/lib/page'
import { feeds$ } from '@/states/feeds'
import { showConfirm } from '@/lib/confirm'

const UNGROUPED_FOLDER_ID = '__ungrouped__'
const NEW_FOLDER_ID = '__new__'

export const BookmarkModal = () => {
  const bookmark = useValue(ui$.bookmarkModalBookmark)
  const bookmarkModalMode = useValue(ui$.bookmarkModalMode)
  const onClose = () => {
    ui$.bookmarkModalBookmark.set(undefined)
    ui$.bookmarkModalMode.set('default')
  }
  const [title, setTitle] = useState('')
  const folders = useValue(folders$.folders)
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const [draftBookmark, setDraftBookmark] = useState(bookmark)

  useEffect(() => {
    setTitle(bookmark?.title || '')
    setDraftBookmark(bookmark)
  }, [bookmark])

  const folderTab = useMemo(() => {
    if (!draftBookmark) {
      return 'watch'
    }
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

  const filteredFolders = useMemo(() => {
    return [
      newFolder(folderTab, { id: UNGROUPED_FOLDER_ID, name: t('modals.ungrouped') }),
      ...sortBy(
        folders.filter((x) => !x.json.deleted && x.json.tab === folderTab),
        ['name'],
      ),
      newFolder(folderTab, { id: NEW_FOLDER_ID, name: t('feeds.newFolder') }),
    ]
  }, [folders, folderTab])

  if (!draftBookmark) {
    return null
  }

  const folder = folders.find((x) => x.id === draftBookmark.json.folder)

  const onChangeFolder = (folder: Folder) => {
    if (folder.id === NEW_FOLDER_ID) {
      ui$.folderModalFolder.set(newFolder(folderTab))
      return
    }
    setDraftBookmark({
      ...draftBookmark,
      json: {
        ...draftBookmark.json,
        folder: folder.id === UNGROUPED_FOLDER_ID ? undefined : folder.id,
      },
    })
    setFolderPickerShown(false)
  }

  const onSubmit = () => {
    if (!title) {
      return
    }
    draftBookmark.title = title
    bookmarks$.saveBookmark(draftBookmark)
    onClose()
  }

  if (!bookmark) {
    return null
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
      <View className="p-5">
        <NouText className="text-lg font-semibold mb-4">
          {bookmarkModalMode === 'feed' ? t('feeds.editFeed') : t('modals.editBookmark')}
        </NouText>
        <NouText className="mb-1 font-semibold text-gray-300">{t('modals.title')}</NouText>
        <TextInput
          className="border border-gray-600 rounded mb-3 text-white p-2 text-sm"
          value={title}
          onChangeText={setTitle}
          placeholder="Later"
          placeholderTextColor={gray.gray11}
        />
        <NouText className="text-sm">{draftBookmark.url}</NouText>
        <NouText className="mt-5 mb-1 font-semibold text-gray-300">{t('modals.folder')}</NouText>
        <View className="flex-row items-center gap-3">
          <NouText className="text-sm">{folder?.name || t('modals.ungrouped')}</NouText>
          <NouButton variant="soft" size="1" onPress={() => setFolderPickerShown(!folderPickerShown)}>
            {t('buttons.move')}
          </NouButton>
        </View>
        {folderPickerShown ? (
          <FlatList
            className="border border-gray-600 rounded my-2 max-h-[200px]"
            data={filteredFolders}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <FolderItem folder={item} onPress={() => onChangeFolder(item)} readOnly />}
          />
        ) : null}
        <View className="flex-row items-center justify-between mt-6">
          <NouButton variant="outline" size="1" onPress={onRemove}>
            {bookmarkModalMode === 'feed' ? t('buttons.unsubscribe') : t('buttons.remove')}
          </NouButton>
          <NouButton onPress={onSubmit}>{t('buttons.save')}</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
