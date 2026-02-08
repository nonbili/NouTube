import { Pressable, View, TouchableOpacity, ActivityIndicator, ScrollView, FlatList } from 'react-native'
import { NouText } from '../NouText'
import { version } from '../../package.json'
import { useMemo, useState } from 'react'
import { colors } from '@/lib/colors'
import { clsx, nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segmented } from '../picker/Segmented'
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
import { t } from 'i18next'

const allFolder = newFolder('', { name: 'All', id: '' })

export const FeedModal = () => {
  const feedModalOpen = useValue(ui$.feedModalOpen)
  const bookmarks = useValue(bookmarks$.bookmarks)
  const feedItems = useValue(feeds$.bookmarks)
  const home = useValue(settings$.home)
  const folders = useValue(folders$.folders)
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const [currentFolder, setCurrentFolder] = useState(allFolder)

  const filteredFolders = useMemo(() => {
    return [
      allFolder,
      newFolder('', { name: t('modals.ungrouped'), id: undefined }),
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
    return feedItems.filter((x) => {
      return channelIds.includes(x.json.id)
    })
  }, [bookmarks, feedItems, feedItems.length, home, currentFolder])

  const onChangeFolder = (folder: Folder) => {
    setCurrentFolder(folder)
    setFolderPickerShown(false)
  }

  return nIf(
    feedModalOpen,
    <BaseModal onClose={() => ui$.feedModalOpen.set(false)}>
      <View className="mt-3 px-2 flex-row items-center">
        <View className="flex-row items-baseline">
          <NouText className="font-semibold text-lg">{t('modals.feed')}</NouText>
        </View>
        <NouButton
          className="font-semibold ml-4"
          variant="outline"
          size="1"
          onPress={() => setFolderPickerShown(!folderPickerShown)}
        >
          {currentFolder.name}
        </NouButton>
      </View>
      {folderPickerShown ? (
        <View className="mt-2 px-2">
          <FlatList
            className="border border-gray-600 rounded my-2 max-h-[200px]"
            data={filteredFolders}
            renderItem={({ item }) => <FolderItem folder={item} onPress={() => onChangeFolder(item)} readOnly />}
          />
        </View>
      ) : null}
      <FlatList
        className="mt-4"
        data={filteredBookmarks}
        keyExtractor={(item) => item.url}
        renderItem={({ item, index }) => <FeedItem bookmark={item} />}
      />
    </BaseModal>,
  )
}
