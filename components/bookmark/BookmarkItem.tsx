import { View, Pressable, useColorScheme } from 'react-native'
import { memo } from 'react'
import { Bookmark, removeBookmark } from '@/states/bookmarks'
import { tabs$ } from '@/states/tabs'
import { ui$, updateUrl } from '@/states/ui'
import { NouText } from '../NouText'
import { isWeb, isIos } from '@/lib/utils'
import { getPageType, getVideoThumbnail } from '@/lib/page'
import { NouMenu } from '../menu/NouMenu'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'
import { share } from '@/lib/share'
import { RetryImage } from '../image/RetryImage'
import MaterialIcons from '@react-native-vector-icons/material-icons'

/* https://www.youtube.com/watch?v=<id> */
function getThumbnail(url: string) {
  try {
    const id = new URL(url).searchParams.get('v')
    return id ? getVideoThumbnail(id) : undefined
  } catch {
    return undefined
  }
}

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const BookmarkItem: React.FC<{ bookmark: Bookmark }> = memo(({ bookmark }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const onPress = () => {
    updateUrl(bookmark.url)
    ui$.assign({ libraryModalOpen: false })
  }

  const pageType = getPageType(bookmark.url)
  const round = pageType?.type === 'channel'
  const square = round || pageType?.home === 'yt-music'

  const thumbnailWidth = square ? 48 : isWeb ? 160 : 112
  const thumbnailHeight = square ? 48 : isWeb ? 90 : 63

  return (
    <View className="flex-row items-start py-2 px-2">
      <Pressable style={{ width: thumbnailWidth }} onPress={onPress}>
        <RetryImage
          source={bookmark.json?.thumbnail || getThumbnail(bookmark.url)}
          contentFit="cover"
          placeholder={{ blurhash }}
          style={{ height: thumbnailHeight, borderRadius: round ? 24 : 8 }}
        />
      </Pressable>
      <Pressable className="flex-1 ml-3" onPress={onPress}>
        <NouText className="leading-5" numberOfLines={isWeb ? 4 : 3} ellipsizeMode="tail">
          {bookmark.title}
        </NouText>
      </Pressable>
      <View>
        <NouMenu
          trigger={isWeb ? <MaterialButton name="more-vert" size={20} /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
          items={[
            ...(isWeb
              ? [
                  {
                    label: t('menus.openInNewTab'),
                    icon: <MaterialIcons name="open-in-new" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
                    handler: () => {
                      tabs$.openTab(bookmark.url)
                      ui$.assign({ libraryModalOpen: false })
                    },
                  },
                ]
              : []),
            {
              label: t('menus.edit'),
              icon: <MaterialIcons name="edit" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
              systemImage: 'pencil',
              handler: () => ui$.bookmarkModalBookmark.set(bookmark),
            },
            {
              label: t('menus.moveTo'),
              icon: <MaterialIcons name="drive-file-move-outline" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
              systemImage: 'folder',
              handler: () => ui$.moveBookmarkModalBookmark.set(bookmark),
            },
            {
              label: t('menus.share'),
              icon: <MaterialIcons name="share" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
              systemImage: 'square.and.arrow.up',
              handler: () => share(bookmark.url),
            },
            {
              label: t('menus.remove'),
              icon: <MaterialIcons name="delete-outline" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
              systemImage: 'trash',
              handler: () => removeBookmark(bookmark),
            },
          ]}
        />
      </View>
    </View>
  )
})

BookmarkItem.displayName = 'BookmarkItem'
