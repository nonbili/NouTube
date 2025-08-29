import { use$ } from '@legendapp/state/react'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { bookmarks$ } from '@/states/bookmarks'
import { useEffect, useMemo, useState } from 'react'
import { getPageType } from '@/lib/page'
import { settings$ } from '@/states/settings'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { Segemented } from '../picker/Segmented'
import { FlatList, View } from 'react-native'
import { clsx, isWeb } from '@/lib/utils'
import { colors } from '@/lib/colors'
import { AntButton, MaterialButton } from '../button/IconButtons'
import { Folder, folders$, newFolder } from '@/states/folders'
import { FolderItem } from '../folder/FolderItem'
import { sortBy } from 'es-toolkit'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

const tabsYT = [
  { label: 'Videos', value: 'watch' },
  { label: 'Channels', value: 'channel' },
  { label: 'Playlists', value: 'playlist' },
]
const tabsYTMusic = [
  { label: 'Songs', value: 'm-watch' },
  { label: 'Artists', value: 'm-channel' },
  { label: 'Playlists', value: 'm-playlist' },
]

const ungroupedFolder = newFolder('', { name: 'Ungrouped', id: '' })

export const LibraryModal = () => {
  const libraryModalOpen = use$(ui$.libraryModalOpen)
  const { bookmarks, updatedAt: bookmarksUpdatedAt } = use$(bookmarks$)
  const home = use$(settings$.home)
  const [tabIndex, setTabIndex] = useState(0)
  const isYTMusic = use$(settings$.isYTMusic)
  const tabs = isYTMusic ? tabsYTMusic : tabsYT
  const { folders, updatedAt: foldersUpdatedAt } = use$(folders$)
  const [currentFolder, setCurrentFolder] = useState<Folder>()
  const currentTab = tabs[tabIndex]

  const filteredFolders = useMemo(() => {
    return sortBy(
      folders.filter((x) => !x.json.deleted && x.json.tab == currentTab.value),
      ['name'],
    )
  }, [folders, foldersUpdatedAt, currentTab])

  const filteredBookmarks = useMemo(() => {
    const types = [['podcast', 'shorts', 'watch'], ['channel'], ['playlist']][tabIndex]
    return bookmarks.filter((x) => {
      if (x.json.deleted || (currentFolder ? (x.json.folder || '') != currentFolder?.id : x.json.folder)) {
        return false
      }
      const pageType = getPageType(x.url)
      return pageType?.home == home && types.includes(pageType?.type)
    })
  }, [bookmarks, bookmarksUpdatedAt, tabIndex, home, currentFolder])

  useEffect(() => {
    setCurrentFolder(filteredFolders.length ? undefined : ungroupedFolder)
    ui$.libraryModalTab.set(currentTab.value)
  }, [currentTab, filteredFolders])

  const visibleFolders = (filteredBookmarks.length ? [ungroupedFolder] : []).concat(filteredFolders)

  return (
    <BaseModal className={libraryModalOpen ? 'block' : 'hidden'} onClose={() => ui$.libraryModalOpen.set(false)}>
      <View className={clsx('px-2 flex-row justify-between items-center mb-4', isWeb && 'mt-4')}>
        {isWeb ? <NouText /> : null}
        <Segemented options={tabs.map((x) => x.label)} selectedIndex={tabIndex} onChange={setTabIndex} />
        <AntButton name="addfolder" size={20} onPress={() => ui$.folderModalFolder.set(newFolder(currentTab.value))} />
      </View>
      {currentFolder != undefined ? (
        <>
          {filteredFolders.length ? (
            <View className="flex-row items-center gap-2 mb-2">
              <MaterialButton name="arrow-back" size={20} onPress={() => setCurrentFolder(undefined)} />
              <NouText>{currentFolder.name}</NouText>
            </View>
          ) : null}
          <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.url}
            renderItem={({ item }) => <BookmarkItem bookmark={item} />}
          />
        </>
      ) : (
        <FlatList
          data={visibleFolders}
          renderItem={({ item }) => <FolderItem folder={item} onPress={() => setCurrentFolder(item)} />}
        />
      )}
    </BaseModal>
  )
}
