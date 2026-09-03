import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, useColorScheme, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useValue } from '@legendapp/state/react'
import { browser } from 'wxt/browser'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { BookmarkModal } from '@/components/modal/BookmarkModal'
import { FeedContent } from '@/components/modal/FeedModal'
import { FolderModal } from '@/components/modal/FolderModal'
import { LibraryModal } from '@/components/modal/LibraryModal'
import { MoveBookmarkModal } from '@/components/modal/MoveBookmarkModal'
import { PlaybackQualityModal } from '@/components/modal/PlaybackQualityModal'
import { PlaybackSpeedModal } from '@/components/modal/PlaybackSpeedModal'
import { NouMenu } from '@/components/menu/NouMenu'
import { NouText } from '@/components/NouText'
import { toolbarPillLabelClass, toolbarPillPressableClass } from '@/components/header/toolbar-classes'
import { colors } from '@/lib/colors'
import { fixPageTitle, getPageType, getThumbnail } from '@/lib/page'
import { formatPlaybackQuality } from '@/lib/playback-quality'
import { formatPlaybackRate } from '@/lib/playback-rate'
import { fetchYouTubeChannelMetadata } from '@/lib/youtube-channel'
import { normalizeUrl } from '@/lib/url'
import { bookmarks$, newBookmark, type Bookmark } from '@/states/bookmarks'
import { settings$ } from '@/states/settings'
import { ui$ } from '@/states/ui'
import { AppShell, useAppSnapshot } from './AppShell'
import { clsx, nIf } from '../../lib/ui'

const openExpanded = () => {
  void browser.tabs.create({ url: browser.runtime.getURL('/tab.html') })
  window.close()
}

const ToolButton: React.FC<{
  name: React.ComponentProps<typeof MaterialIcons>['name']
  label: string
  selected?: boolean
  disabled?: boolean
  color?: string
  onPress: () => void
}> = ({ name, label, selected, disabled, color: requestedColor, onPress }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const color = requestedColor || (selected ? '#4f46e5' : isDark ? colors.icon : colors.iconLightStrong)

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={clsx(
        'h-11 w-11 items-center justify-center rounded-full',
        selected && 'bg-indigo-100 dark:bg-indigo-950',
        disabled && 'opacity-50',
      )}
    >
      <MaterialIcons name={name} size={23} color={color} />
    </Pressable>
  )
}

const ExtensionHeader: React.FC<{
  busy: boolean
  showOpenExpanded: boolean
  currentBookmark?: Bookmark
  canBookmarkCurrentPage: boolean
  onBookmarkCurrentPage: () => void
}> = ({ busy, showOpenExpanded, currentBookmark, canBookmarkCurrentPage, onBookmarkCurrentPage }) => {
  const { t } = useTranslation()
  const colorScheme = useColorScheme()
  const iconColor = colorScheme === 'light' ? colors.iconLightStrong : colors.icon
  const playbackRate = useValue(settings$.playbackRate)
  const playbackQuality = useValue(settings$.playbackQuality)
  const showPlaybackSpeedControl = useValue(settings$.showPlaybackSpeedControl)
  const showPlaybackQualityControl = useValue(settings$.showPlaybackQualityControl)

  return (
    <View className="z-10 flex-row items-center border-b border-zinc-300 bg-zinc-100 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900">
      <ToolButton
        name="video-library"
        label={t('extension.library')}
        onPress={() => ui$.libraryModalOpen.set(true)}
      />
      <ToolButton
        name="rss-feed"
        label={t('extension.feeds')}
        selected
        onPress={() => undefined}
      />
      <View className="flex-1" />
      {nIf(busy, <ActivityIndicator className="mr-1" size="small" />)}
      {nIf(
        showPlaybackSpeedControl,
        <Pressable
          accessibilityLabel={t('modals.playbackSpeed')}
          accessibilityRole="button"
          onPress={() => ui$.playbackSpeedModalOpen.set(true)}
          className={toolbarPillPressableClass(false)}
        >
          <View className={toolbarPillLabelClass(false)}>
            <NouText className="text-xs font-medium">{formatPlaybackRate(playbackRate)}</NouText>
          </View>
        </Pressable>,
      )}
      {nIf(
        showPlaybackQualityControl,
        <Pressable
          accessibilityLabel={t('modals.playbackQuality')}
          accessibilityRole="button"
          onPress={() => ui$.playbackQualityModalOpen.set(true)}
          className={toolbarPillPressableClass(false)}
        >
          <View className={toolbarPillLabelClass(false)}>
            <NouText className="text-xs font-medium">{formatPlaybackQuality(playbackQuality)}</NouText>
          </View>
        </Pressable>,
      )}
      {nIf(
        canBookmarkCurrentPage,
        <ToolButton
          name={currentBookmark ? 'star' : 'star-outline'}
          label={t('extension.saveCurrentPage')}
          color={currentBookmark ? 'gold' : undefined}
          onPress={onBookmarkCurrentPage}
        />,
      )}
      <NouMenu
        trigger={<ToolButton name="more-vert" label={t('extension.more')} onPress={() => undefined} />}
        items={[
          {
            label: t('extension.openYouTube'),
            icon: <MaterialIcons name="smart-display" size={18} color={iconColor} />,
            handler: () => void browser.tabs.create({ url: 'https://www.youtube.com/' }),
          },
          {
            label: t('extension.openYouTubeMusic'),
            icon: <MaterialIcons name="library-music" size={18} color={iconColor} />,
            handler: () => void browser.tabs.create({ url: 'https://music.youtube.com/' }),
          },
          ...(showOpenExpanded
            ? [
                {
                  label: t('extension.openExpanded'),
                  icon: <MaterialIcons name="open-in-new" size={18} color={iconColor} />,
                  handler: openExpanded,
                },
              ]
            : []),
          {
            label: t('settings.label'),
            icon: <MaterialIcons name="settings" size={18} color={iconColor} />,
            handler: () => void browser.runtime.openOptionsPage(),
          },
        ]}
      />
    </View>
  )
}

const ExtensionContent: React.FC<{ showOpenExpanded: boolean }> = ({ showOpenExpanded }) => {
  const { error, setError } = useAppSnapshot()
  const [busy, setBusy] = useState(false)
  const [currentTab, setCurrentTab] = useState<{ title: string; url: string }>()
  const bookmarks = useValue(bookmarks$.bookmarks)

  useEffect(() => {
    if (!showOpenExpanded) {
      return
    }
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url && getPageType(tab.url)?.canStar) {
        setCurrentTab({ title: tab.title || tab.url, url: tab.url })
      }
    })
  }, [showOpenExpanded])

  let normalizedCurrentUrl = ''
  try {
    normalizedCurrentUrl = currentTab?.url ? normalizeUrl(currentTab.url) : ''
  } catch {}
  const storedCurrentBookmark = bookmarks.find((bookmark) => bookmark.url === normalizedCurrentUrl)
  const currentBookmark = storedCurrentBookmark?.json.deleted ? undefined : storedCurrentBookmark

  const bookmarkCurrentPage = async () => {
    if (!currentTab) {
      return
    }
    if (currentBookmark) {
      ui$.bookmarkModalBookmark.set(currentBookmark)
      return
    }

    setBusy(true)
    try {
      const pageType = getPageType(currentTab.url)
      const restoredJson: Bookmark['json'] = storedCurrentBookmark
        ? { ...storedCurrentBookmark.json, deleted: false }
        : {}
      const bookmark = newBookmark({
        ...storedCurrentBookmark,
        url: currentTab.url,
        title: fixPageTitle(currentTab.title) || currentTab.url,
        json: { ...restoredJson, thumbnail: restoredJson.thumbnail || getThumbnail(currentTab.url) },
      })

      if (pageType?.type === 'channel') {
        const metadata = await fetchYouTubeChannelMetadata(currentTab.url, 1)
        bookmark.title = metadata.title || bookmark.title
        bookmark.json.id = metadata.id || bookmark.json.id
        bookmark.json.thumbnail = metadata.thumbnail || bookmark.json.thumbnail
      }
      ui$.bookmarkModalBookmark.set(bookmark)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ExtensionHeader
        busy={busy}
        showOpenExpanded={showOpenExpanded}
        currentBookmark={currentBookmark}
        canBookmarkCurrentPage={Boolean(currentTab)}
        onBookmarkCurrentPage={() => void bookmarkCurrentPage()}
      />
      {nIf(
        error,
        <NouText className="bg-red-100 px-4 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{error}</NouText>,
      )}
      <FeedContent maxContentWidth={960} />

      <LibraryModal />
      <BookmarkModal />
      <MoveBookmarkModal />
      <FolderModal />
      <PlaybackSpeedModal />
      <PlaybackQualityModal />
    </>
  )
}

export const ExtensionHome: React.FC<{ showOpenExpanded?: boolean }> = ({ showOpenExpanded = false }) => (
  <AppShell>
    <ExtensionContent showOpenExpanded={showOpenExpanded} />
  </AppShell>
)
