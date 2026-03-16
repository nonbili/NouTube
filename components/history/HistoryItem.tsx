import { View, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { updateUrl, ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { clsx, isWeb, isIos } from '@/lib/utils'
import { getThumbnail } from '@/lib/page'
import { History, history$ } from '@/states/history'
import { NouMenu } from '../menu/NouMenu'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'
import { share } from '@/lib/share'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

function getHistoryUrl(url: string, duration: number) {
  try {
    const nextUrl = new URL(url)
    const value = nextUrl.searchParams.get('t')
    if (!value) {
      return url
    }

    const t = Number(value)
    if (!Number.isFinite(t)) {
      return url
    }

    const nextT = duration - t < 15 ? 0 : Math.max(t - 5, 0)
    nextUrl.searchParams.set('t', `${nextT}`)
    return nextUrl.toString()
  } catch {
    return url
  }
}

export const HistoryItem: React.FC<{ bookmark: History }> = ({ bookmark }) => {
  const historyUrl = getHistoryUrl(bookmark.url, bookmark.duration)

  const onPress = () => {
    updateUrl(historyUrl)
    ui$.assign({ historyModalOpen: false })
  }

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
          items={[
            { label: t('menus.share'), handler: () => share(historyUrl) },
            { label: t('menus.remove'), handler: () => history$.removeHistory(bookmark) },
          ]}
        />
      </View>
    </View>
  )
}
