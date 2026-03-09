import { View, FlatList } from 'react-native'
import { NouText } from '../NouText'
import { useMemo, useState } from 'react'
import { nIf } from '@/lib/utils'
import { observer, useComputed } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
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

export const FeedModal = observer(() => {
  const feedModalOpen = ui$.feedModalOpen.get()
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const [currentFolder, setCurrentFolder] = useState(allFolder)

  const folders = folders$.folders.get()
  const filteredFolders = useMemo(() => {
    return [
      allFolder,
      newFolder('', { name: t('modals.ungrouped'), id: undefined }),
      ...sortBy(
        folders.filter((x) => x.json.tab == 'channel'),
        ['name'],
      ),
    ]
  }, [folders])

  const bookmarks = bookmarks$.bookmarks.get()
  const feedItems = feeds$.bookmarks.get()

  // Pre-calculate channel mapping for performance
  const channelMap = useMemo(() => {
    const map = new Map()
    for (const b of bookmarks) {
      if (!b.json?.deleted && b.json?.id) {
        map.set(b.json.id, b)
      }
    }
    return map
  }, [bookmarks])

  const filteredBookmarks = useMemo(() => {
    if (currentFolder.id == '') {
      return feedItems
    }
    
    // Efficiently filter by folder using pre-calculated channelMap
    const folderChannelIds = new Set(
      bookmarks
        .filter((x) => x.json.folder == currentFolder.id)
        .map((x) => x.json.id)
        .filter(Boolean)
    )
    
    return feedItems.filter((x) => folderChannelIds.has(x.json.id))
  }, [feedItems, currentFolder.id, bookmarks])

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
})
