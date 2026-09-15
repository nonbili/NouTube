import { View, Pressable } from 'react-native'
import { updateUrl, ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { clsx, isWeb, isIos, nIf } from '@/lib/utils'
import { getThumbnail } from '@/lib/page'
import { History, history$ } from '@/states/history'
import { NouMenu } from '../menu/NouMenu'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'
import { share } from '@/lib/share'
import { RetryImage } from '../image/RetryImage'
import { withResumeTime, withoutResumeTime } from '@/lib/last-playing'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

// Rewinding a little picks the video up where attention was lost rather than
// where playback stopped; a video watched to the end starts over.
const REWIND_SECONDS = 5
const END_MARGIN_SECONDS = 15

// The saved position, not the url: the url comes from player.getVideoUrl(),
// which carries no t param of its own, and the one YouTube does write is
// suffixed ('123s'), so reading it back as a number never worked.
function getHistoryUrl({ url, current, duration }: History) {
  const t = Number(current) || 0
  const total = Number(duration) || 0
  const nextT = total > 0 && total - t < END_MARGIN_SECONDS ? 0 : Math.max(t - REWIND_SECONDS, 0)
  return nextT > 0 ? withResumeTime(url, nextT) : withoutResumeTime(url)
}

export const HistoryItem: React.FC<{ bookmark: History }> = ({ bookmark }) => {
  const historyUrl = getHistoryUrl(bookmark)

  const onPress = () => {
    updateUrl(historyUrl)
    ui$.assign({ historyModalOpen: false })
  }

  const progress = bookmark.duration > 0 ? Math.min(100, Math.max(0, (bookmark.current / bookmark.duration) * 100)) : 0

  return (
    <View className="flex-row my-2 overflow-hidden px-2">
      <View className="flex-row items-center">
        <Pressable className={clsx('w-[120px]')} onPress={onPress}>
          <RetryImage
            source={bookmark.thumbnail || getThumbnail(bookmark.url)}
            contentFit="cover"
            placeholder={{ blurhash }}
            style={{ height: 67.5, borderRadius: 8 }}
          />
          {nIf(
            bookmark.duration > 0,
            <View className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 rounded-b-lg overflow-hidden">
              <View className="h-full bg-red-600" style={{ width: `${progress}%` }} />
            </View>,
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
