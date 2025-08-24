import { use$ } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { FlatList, TextInput, TouchableOpacity, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { Folder, folders$ } from '@/states/folders'
import { NouButton } from '../button/NouButton'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors } from '@/lib/colors'
import { sortBy } from 'es-toolkit'

const FolderItem: React.FC<{ folder: Folder; onPress: () => void }> = ({ folder, onPress }) => {
  return (
    <TouchableOpacity className="flex-row items-center gap-2 p-2" onPress={onPress}>
      <MaterialIcons name="folder-open" color={colors.icon} size={20} />
      <NouText>{folder.name}</NouText>
    </TouchableOpacity>
  )
}

export const BookmarkModal = () => {
  const bookmark = ui$.bookmarkModalBookmark.get()
  const onClose = () => ui$.bookmarkModalBookmark.set(undefined)
  const [title, setTitle] = useState('')
  const folders = use$(folders$.folders)
  const [folderPikcerShown, setFolderPickerShown] = useState(false)
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
    )
  }, [folders, folders.length, currentTab])

  if (!draftBookmark) {
    return null
  }

  const folder = folders.find((x) => x.id == draftBookmark.json.folder)

  const onChangeFolder = (folder: Folder) => {
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
        <NouText className="mb-1">Title</NouText>
        <TextInput
          className="border border-gray-600 rounded mb-3 text-white p-2"
          value={title}
          onChangeText={setTitle}
          placeholder="Later"
          placeholderTextColor={gray.gray11}
        />
        <NouText>{draftBookmark.url}</NouText>
        <View className="mt-5 mb-1 flex-row items-center gap-3">
          <NouText className="">Folder</NouText>
          <NouText>{folder?.name || 'Ungrouped'}</NouText>
          <NouButton variant="soft" size="1" onPress={() => setFolderPickerShown(!folderPikcerShown)}>
            Move
          </NouButton>
        </View>
        {folderPikcerShown ? (
          <FlatList
            className="border border-gray-600 rounded my-2 max-h-[200px]"
            data={filteredFolders}
            renderItem={({ item }) => <FolderItem folder={item} onPress={() => onChangeFolder(item)} />}
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
