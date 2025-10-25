import { Pressable, View, TouchableOpacity, ActivityIndicator, ScrollView, FlatList } from 'react-native'
import { NouText } from '../NouText'
import { version } from '../../package.json'
import { useMemo, useState } from 'react'
import { colors } from '@/lib/colors'
import { clsx, nIf } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segemented } from '../picker/Segmented'
import { getDocumentAsync } from 'expo-document-picker'
import { importCsv } from '@/lib/import'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { FeedItem } from '../feed/FeedItem'
import { feeds$ } from '@/states/feeds'
import { ui$ } from '@/states/ui'
import { BaseModal } from './BaseModal'
import { getPageType } from '@/lib/page'
import { NouButton } from '../button/NouButton'
import { FolderItem } from '../folder/FolderItem'
import { Folder, folders$, newFolder } from '@/states/folders'
import { sortBy } from 'es-toolkit'
import { bookmarks$ } from '@/states/bookmarks'

const allFolder = newFolder('', { name: 'All', id: '' })

export const FeedModal = () => {
  const feedModalOpen = use$(ui$.feedModalOpen)
  const bookmarks = use$(bookmarks$.bookmarks)
  const feedItems = use$(feeds$.bookmarks)
  const home = use$(settings$.home)
  const folders = use$(folders$.folders)
  const [folderPickerShown, setFolderPickerShown] = useState(true)
  const [currentFolder, setCurrentFolder] = useState(allFolder)

  const filteredFolders = useMemo(() => {
    return [
      allFolder,
      newFolder('', { name: 'Ungrouped', id: undefined }),
      ...sortBy(
        folders.filter((x) => x.json.tab == 'channel'),
        ['name'],
      ),
    ]
  }, [folders, folders.length])

  const filteredBookmarks = useMemo(() => {
    if (currentFolder.id == '') {
      return feedItems
    }
    const folderChannels = bookmarks.filter((x) => {
      const pageType = getPageType(x.url)
      return pageType?.home == 'yt' && pageType.type == 'channel' && x.json.folder == currentFolder.id
    })
    const channelIds = folderChannels.map((x) => x.json.id)
    console.log('- channelIds', channelIds)
    return feedItems.filter((x) => {
      return channelIds.includes(x.json.id)
    })
  }, [bookmarks, feedItems, feedItems.length, home, currentFolder])

  const onChangeFolder = (folder: Folder) => {
    setCurrentFolder(folder)
  }

  return nIf(
    feedModalOpen,
    <BaseModal onClose={() => ui$.feedModalOpen.set(false)}>
      <View className="mt-3 mb-4 px-2 flex-row items-center justify-between">
        <View className="flex-row items-baseline">
          <NouText className="font-semibold text-lg">Feeds</NouText>
        </View>
        <NouText className="font-semibold text-lg">{currentFolder.name}</NouText>
      </View>
      {folderPickerShown ? (
        <FlatList
          className="border border-gray-600 rounded my-2 max-h-[200px]"
          data={filteredFolders}
          renderItem={({ item }) => <FolderItem folder={item} onPress={() => onChangeFolder(item)} />}
        />
      ) : null}
      <FlatList
        data={filteredBookmarks}
        keyExtractor={(item) => item.url}
        renderItem={({ item, index }) => <FeedItem bookmark={item} />}
      />
    </BaseModal>,
  )
}
