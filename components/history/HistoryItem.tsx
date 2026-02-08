import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, useValue, useObservable } from '@legendapp/state/react'
import { Image } from 'expo-image'
import { updateUrl, ui$ } from '@/states/ui'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { clsx, isWeb, isIos } from '@/lib/utils'
import { getPageType, getThumbnail, getVideoThumbnail } from '@/lib/page'
import { History, history$ } from '@/states/history'
import { NouMenu } from '../menu/NouMenu'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const HistoryItem: React.FC<{ bookmark: History }> = ({ bookmark }) => {
  const onPress = () => {
    updateUrl(bookmark.url)
    ui$.assign({ historyModalOpen: false })
  }

  const pageType = getPageType(bookmark.url)
  const round = pageType?.type == 'channel'
  const square = round || pageType?.home == 'yt-music'
  const progress = (bookmark.current / bookmark.duration) * 100

  return (
    <View className="flex-row my-2 overflow-hidden px-2">
      <View className="flex-row items-center">
        <Pressable className={clsx('w-[120px]')} onPress={onPress}>
          <Image
            source={bookmark.thumbnail || getThumbnail(bookmark.url)}
            contentFit="cover"
            placeholder={{ blurhash }}
            style={{ height: 67.5, borderRadius: 8 }}
          />
          {bookmark.duration > 0 && (
            <View className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 rounded-b-lg overflow-hidden">
              <View className="h-full bg-red-600" style={{ width: `${progress}%` }} />
            </View>
          )}
        </Pressable>
      </View>
      <Pressable className="flex-1 ml-3" onPress={onPress}>
        <NouText className="leading-6" numberOfLines={3} ellipsizeMode="tail">
          {bookmark.title}
        </NouText>
      </Pressable>
      <View>
        <NouMenu
          trigger={isWeb ? <MaterialButton name="more-vert" size={20} /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
          items={[{ label: t('menus.remove'), handler: () => history$.removeHistory(bookmark) }]}
        />
      </View>
    </View>
  )
}
