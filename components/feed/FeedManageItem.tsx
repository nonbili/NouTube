import { Pressable, View } from 'react-native'
import { Image } from 'expo-image'
import { NouText } from '../NouText'
import { memo } from 'react'
import { t } from 'i18next'
import type { FeedManagementItem } from '@/lib/feed-management'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

function formatTimestamp(value?: Date) {
  if (!value) {
    return t('feeds.never')
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  } catch {
    return value.toLocaleString()
  }
}

export const FeedManageItem: React.FC<{
  item: FeedManagementItem
  onPress: () => void
}> = memo(({ item, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      className="mx-3 my-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-3 active:bg-zinc-800"
    >
      <View className="flex-row items-start gap-3">
        <Image
          source={item.channel.json.thumbnail}
          contentFit="cover"
          placeholder={{ blurhash }}
          style={{ width: 44, height: 44, borderRadius: 22 }}
        />
        <View className="flex-1">
          <View className="flex-row items-start gap-2">
            <NouText className="flex-1 text-[15px] font-semibold" numberOfLines={2}>
              {item.channel.title}
            </NouText>
            <MaterialIcons name="chevron-right" color="#71717a" size={18} />
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-zinc-800 px-3 py-1">
              <MaterialIcons name="folder-open" color="#d4d4d8" size={12} />
              <NouText className="text-xs text-zinc-300">{item.folder?.name || t('modals.ungrouped')}</NouText>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-zinc-950 px-3 py-1">
              <MaterialIcons name="trending-up" color="#d4d4d8" size={12} />
              <NouText className="text-xs text-zinc-300">
                {t('feeds.videosPerDay', { value: item.videosPerDay30d.toFixed(1) })}
              </NouText>
            </View>
          </View>
          <NouText className="mt-2 text-xs text-zinc-500" numberOfLines={1}>
            {t('feeds.lastVideoLabel')}: {formatTimestamp(item.lastVideoAt)}
          </NouText>
        </View>
      </View>
    </Pressable>
  )
})

FeedManageItem.displayName = 'FeedManageItem'
