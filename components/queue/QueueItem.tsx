import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, use$, useObservable } from '@legendapp/state/react'
import { Bookmark } from '@/states/watchlist'
import { Image } from 'expo-image'
import { updateUrl, ui$ } from '@/states/ui'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import { getPageType, getThumbnail, getVideoThumbnail } from '@/lib/page'
import { queue$ } from '@/states/queue'
import { NouMenu } from '../menu/NouMenu'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const QueueItem: React.FC<{ bookmark: Bookmark; playing: boolean }> = ({ bookmark, playing }) => {
  const onPress = () => {
    updateUrl(bookmark.url)
  }

  const pageType = getPageType(bookmark.url)
  const round = pageType?.type == 'channel'
  const square = round || pageType?.home == 'yt-music'

  return (
    <View className="flex-row my-2 overflow-hidden">
      <View className="flex-row items-center">
        <View className="w-6">{playing && <MaterialIcons name="play-arrow" color={colors.icon} size={16} />}</View>
        <Pressable className={clsx('w-[120px]')} onPress={onPress}>
          <Image
            source={bookmark.thumbnail || getThumbnail(bookmark.url)}
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
      <NouMenu
        trigger={
          <MaterialIcons.Button
            color={colors.icon}
            backgroundColor="transparent"
            iconStyle={{ marginRight: 0 }}
            name="more-vert"
            size={20}
          />
        }
        items={[{ label: 'Remove', handler: () => queue$.toggleBookmark(bookmark) }]}
      />
    </View>
  )
}
