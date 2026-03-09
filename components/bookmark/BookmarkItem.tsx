import { View, Pressable } from 'react-native'
import { memo } from 'react'
import { Bookmark } from '@/states/bookmarks'
import { Image } from 'expo-image'
import { ui$, updateUrl } from '@/states/ui'
import { NouText } from '../NouText'
import { clsx, isWeb, isIos } from '@/lib/utils'
import { getPageType, getVideoThumbnail } from '@/lib/page'
import { NouMenu } from '../menu/NouMenu'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'
import { share } from '@/lib/share'

/* https://www.youtube.com/watch?v=<id> */
function getThumbnail(url: string) {
  try {
    const id = new URL(url).searchParams.get('v')
    return id ? getVideoThumbnail(id) : undefined
  } catch (e) {
    return undefined
  }
}

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const BookmarkItem: React.FC<{ bookmark: Bookmark }> = memo(({ bookmark }) => {
  const onPress = () => {
    updateUrl(bookmark.url)
    ui$.assign({ libraryModalOpen: false })
  }

  const pageType = getPageType(bookmark.url)
  const round = pageType?.type == 'channel'
  const square = round || pageType?.home == 'yt-music'

  return (
    <View className="flex flex-row my-2 overflow-hidden px-2">
      <Pressable className={clsx(square ? 'w-[48px]' : 'w-[160px]')} onPress={onPress}>
        <Image
          source={bookmark.json?.thumbnail || getThumbnail(bookmark.url)}
          contentFit="cover"
          placeholder={{ blurhash }}
          style={{ height: square ? 48 : 90, borderRadius: round ? 45 : 8 }}
        />
      </Pressable>
      <Pressable className="flex-1 ml-3" onPress={onPress}>
        <NouText className="leading-6" numberOfLines={4} ellipsizeMode="tail">
          {bookmark.title}
        </NouText>
      </Pressable>
      <View>
        <NouMenu
          trigger={isWeb ? <MaterialButton name="more-vert" size={20} /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
          items={[
            { label: t('menus.edit'), handler: () => ui$.bookmarkModalBookmark.set(bookmark) },
            { label: t('menus.share'), handler: () => share(bookmark.url) },
            { label: t('menus.remove'), handler: () => bookmarks$.toggleBookmark(bookmark) },
          ]}
        />
      </View>
    </View>
  )
})
