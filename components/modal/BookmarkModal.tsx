import { use$ } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { FlatList, TextInput, TouchableOpacity, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { Folder, folders$, newFolder } from '@/states/folders'
import { NouButton } from '../button/NouButton'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors } from '@/lib/colors'
import { sortBy } from 'es-toolkit'
import { FolderItem } from '../folder/FolderItem'

export const BookmarkModal = () => {
  const bookmark = use$(ui$.bookmarkModalBookmark)
  const onClose = () => ui$.bookmarkModalBookmark.set(undefined)
  const [title, setTitle] = useState('')
  const folders = use$(folders$.folders)
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const [draftBookmark, setDraftBookmark] = useState(bookmark)
  const currentTab = use$(ui$.libraryModalTab)

  useEffect(() => {
    setTitle(bookmark?.title || '')
    setDraftBookmark(bookmark)
  }, [bookmark])

  const filteredFolders = useMemo(() => {
    return sortBy(
      folders.filter((x) => x.json.tab == currentTab),
      ['name'],
    ).concat([newFolder(currentTab, { id: '', name: '+ New folder' })])
  }, [folders, folders.length, currentTab])

  if (!draftBookmark) {
    return null
  }

  const folder = folders.find((x) => x.id == draftBookmark.json.folder)

  const onChangeFolder = (folder: Folder) => {
    if (!folder.id) {
      ui$.folderModalFolder.set(newFolder(currentTab))
      return
    }
    setDraftBookmark({
      ...draftBookmark,
      json: {
        ...draftBookmark.json,
        folder: folder.id,
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
    bookmarks$.toggleBookmark(bookmark)
    onClose()
  }

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="text-lg font-semibold mb-4">Edit bookmark</NouText>
        <NouText className="mb-1 font-semibold text-gray-300">Title</NouText>
        <TextInput
          className="border border-gray-600 rounded mb-3 text-white p-2 text-sm"
          value={title}
          onChangeText={setTitle}
          placeholder="Later"
          placeholderTextColor={gray.gray11}
        />
        <NouText className="text-sm">{draftBookmark.url}</NouText>
        <NouText className="mt-5 mb-1 font-semibold text-gray-300">Folder</NouText>
        <View className="flex-row items-center gap-3">
          <NouText className="text-sm">{folder?.name || 'Ungrouped'}</NouText>
          <NouButton variant="soft" size="1" onPress={() => setFolderPickerShown(!folderPickerShown)}>
            Move
          </NouButton>
        </View>
        {folderPickerShown ? (
          <FlatList
            className="border border-gray-600 rounded my-2 max-h-[200px]"
            data={filteredFolders}
            renderItem={({ item }) => <FolderItem folder={item} onPress={() => onChangeFolder(item)} readOnly />}
          />
        ) : null}
        <View className="flex-row items-center justify-between mt-6">
          <NouButton variant="outline" size="1" onPress={onRemove}>
            Remove
          </NouButton>
          <NouButton onPress={onSubmit}>Save</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
