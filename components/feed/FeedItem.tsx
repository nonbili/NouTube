import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, useValue, useObservable } from '@legendapp/state/react'
import { bookmarks$, type Bookmark } from '@/states/bookmarks'
import { Image } from 'expo-image'
import { updateUrl, ui$ } from '@/states/ui'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import { getPageType, getThumbnail, getVideoThumbnail } from '@/lib/page'
import { feeds$ } from '@/states/feeds'
import { NouMenu } from '../menu/NouMenu'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const FeedItem: React.FC<{ bookmark: Bookmark }> = ({ bookmark }) => {
  const bookmarks = useValue(bookmarks$.bookmarks)
  const onPress = () => {
    updateUrl(bookmark.url)
    ui$.assign({ feedModalOpen: false })
  }

  const pageType = getPageType(bookmark.url)
  const round = pageType?.type == 'channel'
  const square = round || pageType?.home == 'yt-music'

  const channel = bookmarks.find((x) => x.json.id == bookmark.json.id && !x.json.deleted)

  if (!channel) {
    return null
  }

  return (
    <>
      <View className="flex-row items-center gap-2 mb-2 px-2">
        <View className="w-[28px]">
          <Image
            source={channel.json?.thumbnail}
            contentFit="cover"
            placeholder={{ blurhash }}
            style={{ height: 28, borderRadius: 18 }}
          />
        </View>
        <NouText className="font-semibold">{channel.title}</NouText>
        <NouText className="ml-2 text-gray-400 text-sm">{dayjs(bookmark.created_at).fromNow()}</NouText>
      </View>
      <View className="flex-row mb-4 overflow-hidden px-2">
        <View className="flex-row items-center">
          <Pressable className={clsx('w-[120px]')} onPress={onPress}>
            <Image
              source={bookmark.json.thumbnail || getThumbnail(bookmark.url)}
              contentFit="cover"
              placeholder={{ blurhash }}
              style={{ height: 67.5, borderRadius: 8 }}
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
}
