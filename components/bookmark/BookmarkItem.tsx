import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, use$, useObservable } from '@legendapp/state/react'
import { Bookmark, watchlist$ } from '@/states/watchlist'
import { Image } from 'expo-image'
import { ui$ } from '@/states/ui'
import { Button, ContextMenu } from '@expo/ui/jetpack-compose'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import { getPageType, getVideoThumbnail } from '@/lib/page'

/* https://www.youtube.com/watch?v=<id> */
function getThumbnail(url: string) {
  const id = new URL(url).searchParams.get('v')
  return id ? getVideoThumbnail(id) : undefined
}

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export const BookmarkItem: React.FC<{ bookmark: Bookmark }> = ({ bookmark }) => {
  const onPress = () => {
    ui$.url.set(bookmark.url)
  }

  const pageType = getPageType(bookmark.url)
  const round = pageType?.type == 'channel'
  const square = round || pageType?.home == 'yt-music'

  return (
    <View className="flex flex-row my-2 overflow-hidden">
      <Pressable className={clsx(square ? 'w-[90px]' : 'w-[160px]')} onPress={onPress}>
        <Image
          source={bookmark.thumbnail || getThumbnail(bookmark.url)}
          contentFit="cover"
          placeholder={{ blurhash }}
          style={{ height: 90, borderRadius: round ? 45 : undefined }}
        />
      </Pressable>
      <Pressable className="flex-1 ml-3" onPress={onPress}>
        <NouText className="leading-6" numberOfLines={4} ellipsizeMode="tail">
          {bookmark.title}
        </NouText>
      </Pressable>
      <ContextMenu color={colors.bg} style={{ height: 36, width: 36 }}>
        {/* @ts-expect-error ?? */}
        <ContextMenu.Items>
          <Button
            elementColors={{
              containerColor: colors.bg,
              contentColor: colors.text,
            }}
            onPress={() => watchlist$.toggleBookmark(bookmark)}
          >
            Remove
          </Button>
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <MaterialIcons.Button
            color={colors.icon}
            backgroundColor="transparent"
            iconStyle={{ marginRight: 0 }}
            name="more-vert"
            size={20}
          />
        </ContextMenu.Trigger>
      </ContextMenu>
    </View>
  )
}
