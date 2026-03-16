import { useValue } from '@legendapp/state/react'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { bookmarks$ } from '@/states/bookmarks'
import { useEffect, useMemo, useState } from 'react'
import { getPageType } from '@/lib/page'
import { settings$ } from '@/states/settings'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { Segmented } from '../picker/Segmented'
import { FlatList, View } from 'react-native'
import { clsx, isWeb } from '@/lib/utils'
import { MaterialButton, MaterialCommunityButton } from '../button/IconButtons'
import { Folder, folders$, newFolder } from '@/states/folders'
import { FolderItem } from '../folder/FolderItem'
import { sortBy } from 'es-toolkit'
import { t } from 'i18next'

const tabsYT = [
  { label: t('library.videos'), value: 'watch' },
  { label: t('library.channels'), value: 'channel' },
  { label: t('library.playlists'), value: 'playlist' },
]
const tabsYTMusic = [
  { label: t('library.songs'), value: 'm-watch' },
  { label: t('library.artists'), value: 'm-channel' },
  { label: t('library.playlists'), value: 'm-playlist' },
]

const ungroupedFolder = newFolder('', { name: t('modals.ungrouped'), id: '' })

export const LibraryModal = () => {
  const libraryModalOpen = useValue(ui$.libraryModalOpen)
  const home = useValue(settings$.home)
  const isYTMusic = useValue(settings$.isYTMusic)
  const folderState = useValue(folders$)
  const bookmarkState = useValue(bookmarks$)
  
  const [tabIndex, setTabIndex] = useState(0)
  const [currentFolder, setCurrentFolder] = useState<Folder>()
  
  const tabs = isYTMusic ? tabsYTMusic : tabsYT
  const currentTab = tabs[tabIndex]

  const filteredFolders = useMemo(() => {
    return sortBy(
      folderState.folders.filter((x) => !x.json.deleted && x.json.tab === currentTab.value),
      ['name'],
    )
  }, [folderState, currentTab.value])

  const filteredBookmarks = useMemo(() => {
    const types = [['podcast', 'shorts', 'watch'], ['channel'], ['playlist']][tabIndex]
    return bookmarkState.bookmarks.filter((x) => {
      if (x.json.deleted || (currentFolder ? (x.json.folder || '') !== currentFolder.id : x.json.folder)) {
        return false
      }
      const pageType = getPageType(x.url)
      return pageType?.home === home && types.includes(pageType?.type)
    })
  }, [bookmarkState, tabIndex, home, currentFolder])

  useEffect(() => {
    setCurrentFolder(filteredFolders.length ? undefined : ungroupedFolder)
    ui$.libraryModalTab.set(currentTab.value)
  }, [currentTab.value, filteredFolders.length])

  const visibleFolders = useMemo(() => 
    (filteredBookmarks.length ? [ungroupedFolder] : []).concat(filteredFolders),
    [filteredBookmarks.length, filteredFolders]
  )

  if (!libraryModalOpen) return null

  return (
    <BaseModal onClose={() => ui$.libraryModalOpen.set(false)}>
      <View className={clsx('px-2 flex-row justify-between items-center mb-4', isWeb && 'mt-4')}>
        {isWeb ? <NouText /> : null}
        <Segmented options={tabs.map((x) => x.label)} selectedIndex={tabIndex} onChange={setTabIndex} />
        <MaterialCommunityButton
          name="folder-plus-outline"
          size={20}
          onPress={() => ui$.folderModalFolder.set(newFolder(currentTab.value))}
        />
      </View>
      {currentFolder !== undefined ? (
        <>
          {filteredFolders.length ? (
            <View className="flex-row items-center gap-2 mb-2">
              <MaterialButton name="arrow-back" size={20} onPress={() => setCurrentFolder(undefined)} />
              <NouText className="flex-1">{currentFolder.name}</NouText>
            </View>
          ) : null}
          <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.url}
            renderItem={({ item }) => <BookmarkItem bookmark={item} />}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </>
      ) : (
        <FlatList
          data={visibleFolders}
          keyExtractor={(item) => item.id || 'ungrouped'}
          renderItem={({ item }) => <FolderItem folder={item} onPress={() => setCurrentFolder(item)} />}
        />
      )}
    </BaseModal>
  )
}
