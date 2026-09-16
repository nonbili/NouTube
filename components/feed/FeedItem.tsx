import { View, Pressable } from 'react-native'
import { memo } from 'react'
import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import { library$ } from '@/states/library'
import { useValue } from '@legendapp/state/react'
import { getBookmarkKey, normalizeUrl } from '@/lib/url'
import { Image } from 'expo-image'
import { updateUrl, ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { getThumbnail } from '@/lib/page'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { share } from '@/lib/share'
import { MaterialButton } from '../button/IconButtons'
import { NouMenu } from '../menu/NouMenu'
import { isIos, isWeb } from '@/lib/utils'
import { t } from 'i18next'
import { RetryImage } from '../image/RetryImage'
import MaterialIcons from '@react-native-vector-icons/material-icons'

dayjs.extend(relativeTime)

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const FeedItem: React.FC<{
  bookmark: Bookmark
  channel?: Bookmark
  onPressChannel?: (channel: Bookmark) => void
}> = memo(({ bookmark, channel, onPressChannel: onSelectChannel }) => {
  const starUrl = normalizeUrl(bookmark.url)
  const starred = useValue(library$.urls).has(getBookmarkKey(starUrl))

  const onPress = () => {
    updateUrl(bookmark.url)
    ui$.assign({ feedModalOpen: false })
  }

  if (!channel) {
    return null
  }

  const onPressChannel = () => {
    onSelectChannel?.(channel)
  }

  return (
    <>
      <View className="flex-row items-center gap-2 mb-2 px-2">
        <Pressable className="flex-1 flex-row items-center gap-2" onPress={onPressChannel}>
          <View className="w-[28px]">
            <Image
              source={channel.json?.thumbnail}
              contentFit="cover"
              placeholder={{ blurhash }}
              style={{ height: 28, borderRadius: 14 }}
            />
          </View>
          <NouText className="font-semibold flex-1" numberOfLines={1}>
            {channel.title}
          </NouText>
        </Pressable>
        <NouText className="ml-2 text-sm whitespace-nowrap text-zinc-500 dark:text-gray-400">
          {dayjs(bookmark.created_at).fromNow()}
        </NouText>
        <NouMenu
          trigger={isWeb ? <MaterialButton name="more-vert" size={20} /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
          items={[
            {
              label: starred ? t('menus.unstar') : t('menus.star'),
              icon: <MaterialIcons name={starred ? 'star' : 'star-outline'} size={18} color="#475569" />,
              systemImage: starred ? 'star.slash' : 'star',
              handler: () =>
                bookmarks$.toggleBookmark(
                  newBookmark({
                    url: starUrl,
                    title: bookmark.title,
                    json: { thumbnail: bookmark.json?.thumbnail },
                  }),
                ),
            },
            {
              label: t('menus.download'),
              icon: <MaterialIcons name="download" size={18} color="#475569" />,
              systemImage: 'arrow.down.circle',
              handler: () => {
                ui$.toolsModalUrl.set(starUrl)
                ui$.toolsModalOpen.set(true)
                ui$.assign({ feedModalOpen: false })
              },
            },
            {
              label: t('menus.share'),
              icon: <MaterialIcons name="share" size={18} color="#475569" />,
              systemImage: 'square.and.arrow.up',
              handler: () => share(bookmark.url),
            },
          ]}
        />
      </View>
      <View className="flex-row mb-4 overflow-hidden px-2">
        <View className="flex-row items-center">
          <Pressable className="w-[152px]" onPress={onPress}>
            <RetryImage
              source={bookmark.json.thumbnail || getThumbnail(bookmark.url)}
              contentFit="cover"
              placeholder={{ blurhash }}
              style={{ height: 85.5, borderRadius: 10 }}
            />
          </Pressable>
        </View>
        <Pressable className="flex-1 ml-3" onPress={onPress}>
          <NouText className="leading-6" numberOfLines={3} ellipsizeMode="tail">
            {bookmark.title}
          </NouText>
        </Pressable>
      </View>
    </>
  )
})

FeedItem.displayName = 'FeedItem'
