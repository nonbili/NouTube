import { Dimensions, View, Text, Share } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useCallback, useEffect, useRef, useState } from 'react'
import Drawer from 'expo-router/drawer'
import { Bookmark, watchlist$ } from '@/states/watchlist'
import { use$, useObserve } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { Button, ContextMenu } from '@expo/ui/jetpack-compose'
import { fixSharingUrl, getPageType } from '@/lib/page'
import { settings$ } from '@/states/settings'
import { colors } from '@/lib/colors'
import { SettingsModal } from '../modal/SettingsModal'
import { queue$ } from '@/states/queue'

export const DrawerScreen: React.FC<{ noutube: any }> = ({ noutube }) => {
  const navigation = useNavigation()
  const uiState = use$(ui$)
  const isYTMusic = use$(settings$.isYTMusic)
  const allStarred = use$(watchlist$.urls)
  const [settingsModalShown, setSettingsModalShown] = useState(false)
  const queueSize = use$(queue$.size)

  const pageType = getPageType(uiState.pageUrl)
  const starred = allStarred.has(uiState.pageUrl)
  const onToggleStar = async () => {
    const bookmark: Bookmark = { url: uiState.pageUrl, title: uiState.title }
    if (!starred) {
      if (isYTMusic) {
        switch (pageType?.type) {
          case 'watch': {
            const data = await noutube?.eval(
              `document.querySelector('#movie_player').getPlayerResponse()?.videoDetails`,
            )
            const { author, title, thumbnail } = JSON.parse(data)
            if (author && title) {
              bookmark.title = `${title} - ${author}`
              bookmark.thumbnail = thumbnail?.thumbnails?.at(-1)?.url
            }
            break
          }
          case 'channel': {
            const title = await noutube?.eval(
              `document.querySelector('ytmusic-immersive-header-renderer h1')?.innerText`,
            )
            const thumbnail = await noutube?.eval(
              `document.querySelector('ytmusic-immersive-header-renderer img')?.src`,
            )
            if (title && title != 'null') {
              bookmark.title = title
              bookmark.thumbnail = thumbnail
            }
            break
          }
          case 'podcast':
          case 'playlist': {
            const thumbnail = await noutube?.eval(
              `document.querySelector('ytmusic-responsive-header-renderer ytmusic-thumbnail-renderer.thumbnail img')?.src`,
            )
            bookmark.thumbnail = thumbnail
            const title = await noutube?.eval(
              `document.querySelector('ytmusic-responsive-header-renderer h1')?.innerText`,
            )
            let author = await noutube?.eval(
              `document.querySelector('ytmusic-responsive-header-renderer .strapline-text')?.innerText`,
            )
            if (title) {
              bookmark.title = title
              if (author && author != 'null') {
                author = author.replaceAll('\\n', '')
                bookmark.title += ` - ${author}`
              }
            }
            break
          }
        }
      } else if (pageType?.type == 'channel') {
        const thumbnail = await noutube?.eval(
          `document.querySelector('yt-page-header-view-model yt-avatar-shape img')?.src`,
        )
        bookmark.thumbnail = thumbnail
      }
    }
    watchlist$.toggleBookmark(bookmark)
  }

  const onToggleHome = () => {
    let newUrl = 'https://music.youtube.com'
    if (isYTMusic) {
      newUrl = 'https://m.youtube.com'
    }
    ui$.url.set(newUrl)
  }

  const { width, height } = Dimensions.get('window')
  const isPortrait = height > width

  return (
    <>
      <Drawer.Screen
        options={{
          title: uiState.title,
          /* headerTitleAlign: isPortrait ? 'left' : 'center', */
          headerTitleAlign: 'left',
          headerTitleStyle: {
            fontSize: 14,
          },
          headerTitleContainerStyle: {
            maxWidth: isPortrait && queueSize ? '40%' : '60%',
          },
          headerStyle: {
            height: 88,
          },
          headerLeft: (props) => (
            <View className="pl-3">
              <MaterialIcons.Button
                color={colors.icon}
                backgroundColor="transparent"
                iconStyle={{ marginRight: 0 }}
                name={isYTMusic ? 'library-music' : 'video-library'}
                size={24}
                onPress={() => navigation.dispatch(DrawerActions.openDrawer)}
                underlayColor={colors.underlay}
              />
            </View>
          ),
          headerRight: () => (
            <View className="flex flex-row gap-3 pr-2">
              {!isYTMusic && queueSize > 0 && (
                <MaterialIcons.Button
                  color={colors.icon}
                  backgroundColor="transparent"
                  iconStyle={{ marginRight: 0 }}
                  name="playlist-play"
                  size={24}
                  onPress={() => ui$.queueModalShown.set(!ui$.queueModalShown.get())}
                  underlayColor={colors.underlay}
                />
              )}
              {pageType?.canStar && (
                <MaterialIcons.Button
                  color={starred ? 'gold' : colors.icon}
                  backgroundColor="transparent"
                  iconStyle={{ marginRight: 0 }}
                  name={starred ? 'star' : 'star-outline'}
                  size={24}
                  onPress={onToggleStar}
                  underlayColor={colors.underlay}
                />
              )}
              <ContextMenu color={colors.bg}>
                {/* @ts-expect-error ?? */}
                <ContextMenu.Items>
                  <Button
                    elementColors={{
                      containerColor: colors.bg,
                      contentColor: colors.text,
                    }}
                    onPress={onToggleHome}
                  >
                    {isYTMusic ? 'YouTube' : 'YouTube Music'}
                  </Button>
                  <Button
                    elementColors={{
                      containerColor: colors.bg,
                      contentColor: colors.text,
                    }}
                    onPress={() => Share.share({ message: fixSharingUrl(uiState.pageUrl) })}
                  >
                    Share
                  </Button>
                  <Button
                    elementColors={{
                      containerColor: colors.bg,
                      contentColor: colors.text,
                    }}
                    onPress={() => setSettingsModalShown(true)}
                  >
                    Settings
                  </Button>
                </ContextMenu.Items>
                <ContextMenu.Trigger>
                  <MaterialIcons.Button
                    color={colors.icon}
                    backgroundColor="transparent"
                    iconStyle={{ marginRight: 0 }}
                    name="more-vert"
                    size={24}
                    underlayColor={colors.underlay}
                  />
                </ContextMenu.Trigger>
              </ContextMenu>
            </View>
          ),
        }}
      />
      {settingsModalShown && <SettingsModal onClose={() => setSettingsModalShown(false)} />}
    </>
  )
}
