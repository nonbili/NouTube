import { View, FlatList } from 'react-native'
import { NouText } from '../NouText'
import { useMemo, useState } from 'react'
import { nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { FeedItem } from '../feed/FeedItem'
import { feeds$ } from '@/states/feeds'
import { ui$ } from '@/states/ui'
import { BaseModal } from './BaseModal'
import { NouButton } from '../button/NouButton'
import { FolderItem } from '../folder/FolderItem'
import { Folder, folders$, newFolder } from '@/states/folders'
import { sortBy } from 'es-toolkit'
import { bookmarks$ } from '@/states/bookmarks'
import { t } from 'i18next'

const allFolder = newFolder('', { name: 'All', id: '' })

export const FeedModal = () => {
  const feedModalOpen = useValue(ui$.feedModalOpen)
  const folderState = useValue(folders$)
  const bookmarkState = useValue(bookmarks$)
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const [currentFolder, setCurrentFolder] = useState(allFolder)

  const filteredFolders = useMemo(() => {
    return [
      allFolder,
      newFolder('', { name: t('modals.ungrouped'), id: undefined }),
      ...sortBy(
        folderState.folders.filter((x) => x.json.tab === 'channel'),
        ['name'],
      ),
    ]
  }, [folderState])

  const feedItems = useValue(feeds$.bookmarks)

  // Pre-calculate channel mapping for performance
  const channelMap = useMemo(() => {
    const map = new Map()
    for (const b of bookmarkState.bookmarks) {
      if (!b.json?.deleted && b.json?.id) {
        map.set(b.json.id, b)
      }
    }
    return map
  }, [bookmarkState])

  const filteredBookmarks = useMemo(() => {
    if (currentFolder.id === '') {
      return feedItems
    }
    
    // Efficiently filter by folder using pre-calculated channelMap
    const folderChannelIds = new Set(
      bookmarkState.bookmarks
        .filter((x) => x.json.folder === currentFolder.id)
        .map((x) => x.json.id)
        .filter(Boolean)
    )
    
    return feedItems.filter((x) => folderChannelIds.has(x.json.id))
  }, [feedItems, currentFolder.id, bookmarkState])

  const onChangeFolder = (folder: Folder) => {
    setCurrentFolder(folder)
    setFolderPickerShown(false)
  }

  return nIf(
    feedModalOpen,
    <BaseModal onClose={() => ui$.feedModalOpen.set(false)}>
      <View className="mt-3 px-2 flex-row items-center">
        <View className="flex-row items-baseline">
          <NouText className="font-semibold text-lg">{t('modals.feeds')}</NouText>
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
            keyExtractor={(item) => item.id || 'ungrouped'}
            renderItem={({ item }) => <FolderItem folder={item} onPress={() => onChangeFolder(item)} readOnly />}
          />
        </View>
      ) : null}
      <FlatList
        className="mt-4"
        data={filteredBookmarks}
        keyExtractor={(item, index) => item.url + index}
        renderItem={({ item }) => (
          <FeedItem 
            bookmark={item} 
            channel={channelMap.get(item.json.id)} 
          />
        )}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </BaseModal>,
  )
}
