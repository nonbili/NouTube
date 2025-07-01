import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, use$, useObservable } from '@legendapp/state/react'
import { Bookmark, watchlist$ } from '@/states/watchlist'
import { Image } from 'expo-image'
import { ui$ } from '@/states/ui'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { Picker } from '@expo/ui/jetpack-compose'
import { useMemo, useState } from 'react'
import { getPageType } from '@/lib/page'
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer'
import { colors } from '@/lib/colors'
import { BookmarkTabs } from '../bookmark/BookmarkTabs'
import { settings$ } from '@/states/settings'

export function DrawerContent(props: DrawerContentComponentProps) {
  const watchlist = use$(watchlist$.bookmarks)
  const home = use$(settings$.home)
  const [tabIndex, setTabIndex] = useState(0)

  const filteredWatchlist = useMemo(() => {
    const types = [['podcast', 'shorts', 'watch'], ['channel'], ['playlist']][tabIndex]
    return watchlist.filter((x) => {
      const pageType = getPageType(x.url)
      return pageType?.home == home && types.includes(pageType?.type)
    })
  }, [watchlist, watchlist.length, tabIndex, home])

  return (
    <DrawerContentScrollView {...props}>
      <BookmarkTabs tabIndex={tabIndex} onChange={setTabIndex} />

      {filteredWatchlist.map((bookmark, index) => (
        <BookmarkItem bookmark={bookmark} key={bookmark.url} />
      ))}
    </DrawerContentScrollView>
  )
}
