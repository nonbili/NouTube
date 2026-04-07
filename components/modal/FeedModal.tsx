import { ActivityIndicator, BackHandler, FlatList, Pressable, TextInput, View, useColorScheme, useWindowDimensions } from 'react-native'
import { NouText } from '../NouText'
import { useEffect, useState } from 'react'
import { clsx, isWeb, nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { FeedItem } from '../feed/FeedItem'
import { feeds$ } from '@/states/feeds'
import { ui$ } from '@/states/ui'
import { BaseModal } from './BaseModal'
import { folders$ } from '@/states/folders'
import { sortBy } from 'es-toolkit'
import { bookmarks$ } from '@/states/bookmarks'
import { settings$ } from '@/states/settings'
import { t } from 'i18next'
import { getPageType } from '@/lib/page'
import {
  ALL_FEED_FILTER_KEY,
  buildFeedManagementItems,
  filterFeedManagementItems,
  makeChannelFeedFilterKey,
  makeFolderFeedFilterKey,
  parseFeedFilterKey,
  type FeedManageOrder,
  type FeedManageSort,
} from '@/lib/feed-management'
import { FeedManageItem } from '../feed/FeedManageItem'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { gray } from '@radix-ui/colors'
import { refreshChannelFeed } from '@/lib/feeder'
import { showToast } from '@/lib/toast'

const MENU_TOP = 68

interface FeedFilterOption {
  key: string
  name: string
  icon: keyof typeof MaterialIcons.glyphMap
  thumbnail?: string
}

interface FeedMenuItem {
  key: string
  label: string
  icon: keyof typeof MaterialIcons.glyphMap
  thumbnail?: string
  selected?: boolean
  onPress: () => void
}

interface FeedEmptyStateAction {
  key: string
  label: string
  onPress: () => void
  icon?: keyof typeof MaterialIcons.glyphMap
  loading?: boolean
  disabled?: boolean
  tone?: 'default' | 'accent'
}

export const FeedModal = () => {
  const feedModalOpen = useValue(ui$.feedModalOpen)
  const folders = useValue(folders$.folders)
  const bookmarks = useValue(bookmarks$.bookmarks)
  const feedState = useValue(feeds$.feeds)
  const feedItems = useValue(feeds$.bookmarks)
  const hideShorts = useValue(settings$.hideShorts)
  const bookmarkModalBookmark = useValue(ui$.bookmarkModalBookmark)
  const { width } = useWindowDimensions()
  const isNarrowNative = !isWeb && width < 768
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const iconColor = isDark ? 'white' : '#111827'

  const [modeIndex, setModeIndex] = useState(0)
  const [filterKey, setFilterKey] = useState(ALL_FEED_FILTER_KEY)
  const [sortIndex, setSortIndex] = useState(0)
  const [order, setOrder] = useState<FeedManageOrder>('desc')
  const [activeMenu, setActiveMenu] = useState<'folder' | 'sort'>()
  const [filterMenuQuery, setFilterMenuQuery] = useState('')
  const [isRefreshingCurrentChannel, setIsRefreshingCurrentChannel] = useState(false)

  useEffect(() => {
    if (!feedModalOpen) {
      setModeIndex(0)
      setFilterKey(ALL_FEED_FILTER_KEY)
      setSortIndex(0)
      setOrder('desc')
      setActiveMenu(undefined)
      setFilterMenuQuery('')
      setIsRefreshingCurrentChannel(false)
    }
  }, [feedModalOpen])

  const mode = modeIndex === 0 ? 'updates' : 'manage'
  const sort: FeedManageSort = sortIndex === 0 ? 'lastVideo' : 'frequency'

  useEffect(() => {
    if (!feedModalOpen || isWeb) {
      return
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (bookmarkModalBookmark) {
        ui$.bookmarkModalBookmark.set(undefined)
        ui$.bookmarkModalMode.set('default')
        return true
      }
      if (activeMenu) {
        setActiveMenu(undefined)
        return true
      }
      if (mode === 'manage') {
        setModeIndex(0)
        return true
      }
      ui$.feedModalOpen.set(false)
      return true
    })

    return () => subscription.remove()
  }, [activeMenu, bookmarkModalBookmark, feedModalOpen, mode])

  const savedChannelBookmarks = bookmarks.filter((bookmark) => {
    const pageType = getPageType(bookmark.url)
    return !bookmark.json.deleted && pageType?.home === 'yt' && pageType.type === 'channel'
  })

  const folderFilterOptions: FeedFilterOption[] = [
    { key: ALL_FEED_FILTER_KEY, name: t('feeds.allFolders'), icon: 'view-list' },
    { key: makeFolderFeedFilterKey(''), name: t('modals.ungrouped'), icon: 'folder-open' },
    ...sortBy(
      folders.filter((x) => !x.json.deleted && x.json.tab === 'channel'),
      ['name'],
    ).map((folder) => ({ key: makeFolderFeedFilterKey(folder.id), name: folder.name, icon: 'folder-open' as const })),
  ]
  const channelFilterOptions: FeedFilterOption[] = [
    ...sortBy(savedChannelBookmarks, ['title']).map((channel) => ({
      key: makeChannelFeedFilterKey(channel.id),
      name: channel.title,
      icon: 'rss-feed' as const,
      thumbnail: channel.json.thumbnail,
    })),
  ]
  const filterOptions = mode === 'manage' ? folderFilterOptions : folderFilterOptions.concat(channelFilterOptions)
  const parsedFilter = parseFeedFilterKey(filterKey)

  const subscribedChannelIds = new Set(feedState.map((feed) => feed.id))

  const channelBookmarks = savedChannelBookmarks.filter((bookmark) => {
    return !!bookmark.json.id && subscribedChannelIds.has(bookmark.json.id)
  })

  const channelMap = new Map<string, (typeof channelBookmarks)[number]>()
  for (const channel of channelBookmarks) {
    if (channel.json.id) {
      channelMap.set(channel.json.id, channel)
    }
  }
  const hasFilterOption = filterOptions.some((option) => option.key === filterKey)

  useEffect(() => {
    if (!hasFilterOption) {
      setFilterKey(ALL_FEED_FILTER_KEY)
    }
  }, [filterKey, hasFilterOption])

  useEffect(() => {
    if (activeMenu !== 'folder') {
      setFilterMenuQuery('')
    }
  }, [activeMenu])

  const managementItems = buildFeedManagementItems({ channels: channelBookmarks, feedBookmarks: feedItems, folders })

  const visibleManagementItems = filterFeedManagementItems({
    items: managementItems,
    search: '',
    filterKey,
    sort,
    order,
  })

  const visibleFeedItems = feedItems.filter((bookmark) => {
    const channel = bookmark.json.id ? channelMap.get(bookmark.json.id) : undefined
    if (!channel) {
      return false
    }

    if (hideShorts && getPageType(bookmark.url)?.type === 'shorts') {
      return false
    }

    if (parsedFilter.kind === 'all') {
      return true
    }

    if (parsedFilter.kind === 'folder') {
      return (channel.json.folder || '') === parsedFilter.id
    }

    return channel.id === parsedFilter.id
  })

  const onClose = () => ui$.feedModalOpen.set(false)

  const currentFilter = filterOptions.find((option) => option.key === filterKey)
  const currentFilterLabel = currentFilter?.name || t('feeds.allFolders')
  const currentFilterIcon = currentFilter?.icon || 'view-list'
  const currentFilterThumbnail = currentFilter?.thumbnail
  const currentOrderLabel = sort === 'lastVideo' ? t('feeds.sortLastVideo') : t('feeds.sortFrequency')
  const currentChannelBookmark =
    parsedFilter.kind === 'channel' ? savedChannelBookmarks.find((bookmark) => bookmark.id === parsedFilter.id) : undefined

  const handleRefreshCurrentChannel = async () => {
    if (!currentChannelBookmark || isRefreshingCurrentChannel) {
      return
    }

    setIsRefreshingCurrentChannel(true)
    try {
      const result = await refreshChannelFeed(currentChannelBookmark.id)
      if (result === 'success') {
        showToast(t('feeds.fetchToastSuccess'))
      } else if (result === 'already-running') {
        showToast(t('feeds.fetchToastRunning'))
      } else if (result === 'not-found') {
        showToast(t('feeds.fetchToastNotFound'))
      } else {
        showToast(t('feeds.fetchToastError'))
      }
    } finally {
      setIsRefreshingCurrentChannel(false)
    }
  }

  const updatesEmptyState = !savedChannelBookmarks.length
    ? {
        icon: 'rss-feed',
        title: t('feeds.emptyTitleNoChannels'),
        body: t('feeds.emptyBodyNoChannels'),
        actions: [] as FeedEmptyStateAction[],
      }
    : parsedFilter.kind === 'folder'
      ? {
          icon: 'folder-open',
          title: t('feeds.emptyTitleFolder', { folder: currentFilterLabel }),
          body: t('feeds.emptyBodyFiltered'),
          actions: [
            {
              key: 'allFolders',
              label: t('feeds.emptyActionAllFolders'),
              onPress: () => setFilterKey(ALL_FEED_FILTER_KEY),
            },
          ] as FeedEmptyStateAction[],
        }
      : parsedFilter.kind === 'channel'
        ? {
            icon: 'rss-feed',
            title: t('feeds.emptyTitleChannel', { channel: currentFilterLabel }),
            body: t('feeds.emptyBodyFiltered'),
            actions: [
              ...(currentChannelBookmark
                ? ([
                    {
                      key: 'refresh',
                      label: t('feeds.emptyActionFetchNow'),
                      onPress: () => {
                        void handleRefreshCurrentChannel()
                      },
                      icon: 'refresh',
                      loading: isRefreshingCurrentChannel,
                      disabled: isRefreshingCurrentChannel,
                      tone: 'accent',
                    },
                  ] satisfies FeedEmptyStateAction[])
                : []),
              {
                key: 'allFolders',
                label: t('feeds.emptyActionAllFolders'),
                onPress: () => setFilterKey(ALL_FEED_FILTER_KEY),
              },
            ] as FeedEmptyStateAction[],
          }
      : {
          icon: 'hourglass-empty',
          title: t('feeds.emptyTitleWaiting'),
          body: t('feeds.emptyBodyWaiting'),
          actions: [] as FeedEmptyStateAction[],
        }

  const renderFilterAvatar = (option: Pick<FeedFilterOption, 'icon' | 'thumbnail'> | Pick<FeedMenuItem, 'icon' | 'thumbnail'>) => {
    if (option.thumbnail) {
      return <Image source={option.thumbnail} contentFit="cover" style={{ width: 18, height: 18, borderRadius: 9 }} />
    }

    return <MaterialIcons name={option.icon} color={iconColor} size={16} />
  }

  const menuItems: FeedMenuItem[] =
    activeMenu === 'folder'
      ? filterOptions.map((option) => ({
          key: option.key,
          label: option.name,
          icon: option.icon,
          thumbnail: option.thumbnail,
          selected: option.key === filterKey,
          onPress: () => {
            setFilterKey(option.key)
            setActiveMenu(undefined)
          },
        }))
      : [
          {
            key: 'lastVideoDesc',
            label: t('feeds.lastVideoNewest'),
            icon: 'south',
            selected: sortIndex === 0 && order === 'desc',
            onPress: () => {
              setSortIndex(0)
              setOrder('desc')
              setActiveMenu(undefined)
            },
          },
          {
            key: 'lastVideoAsc',
            label: t('feeds.lastVideoOldest'),
            icon: 'north',
            selected: sortIndex === 0 && order === 'asc',
            onPress: () => {
              setSortIndex(0)
              setOrder('asc')
              setActiveMenu(undefined)
            },
          },
          {
            key: 'frequencyDesc',
            label: t('feeds.frequencyHighest'),
            icon: 'trending-down',
            selected: sortIndex === 1 && order === 'desc',
            onPress: () => {
              setSortIndex(1)
              setOrder('desc')
              setActiveMenu(undefined)
            },
          },
          {
            key: 'frequencyAsc',
            label: t('feeds.frequencyLowest'),
            icon: 'trending-up',
            selected: sortIndex === 1 && order === 'asc',
            onPress: () => {
              setSortIndex(1)
              setOrder('asc')
              setActiveMenu(undefined)
            },
          },
        ]

  const shouldShowFilterInput = activeMenu === 'folder'
  const normalizedFilterMenuQuery = filterMenuQuery.trim().toLocaleLowerCase()
  const visibleMenuItems =
    activeMenu === 'folder' && normalizedFilterMenuQuery
      ? menuItems.filter(
          (item) => item.key === ALL_FEED_FILTER_KEY || item.label.toLocaleLowerCase().includes(normalizedFilterMenuQuery),
        )
      : menuItems

  const content = (
    <View className="flex-1 bg-zinc-100 dark:bg-zinc-950">
      <View className="border-b border-zinc-300 dark:border-zinc-800 px-3 py-3">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={mode === 'manage' ? () => setModeIndex(0) : onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-900"
          >
            <MaterialIcons name={mode === 'manage' ? 'arrow-back' : 'close'} color={iconColor} size={22} />
          </Pressable>
          <NouText className="flex-1 text-lg font-semibold">{t('modals.feeds')}</NouText>
          <Pressable
            onPress={() => setActiveMenu((value) => (value === 'folder' ? undefined : 'folder'))}
            className="max-w-[150px] flex-row items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-3 py-2"
          >
            {renderFilterAvatar({ icon: currentFilterIcon, thumbnail: currentFilterThumbnail })}
            <NouText className="flex-1 text-sm" numberOfLines={1}>
              {currentFilterLabel}
            </NouText>
            <MaterialIcons name="arrow-drop-down" color={iconColor} size={18} />
          </Pressable>
          {mode === 'manage' ? (
            <Pressable
              onPress={() => setActiveMenu((value) => (value === 'sort' ? undefined : 'sort'))}
              className="max-w-[110px] flex-row items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-3 py-2"
            >
              <MaterialIcons name="swap-vert" color={iconColor} size={16} />
              <NouText className="flex-1 text-sm" numberOfLines={1}>
                {currentOrderLabel}
              </NouText>
              <MaterialIcons name="arrow-drop-down" color={iconColor} size={18} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setModeIndex(1)}
              className="h-11 w-11 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-900"
            >
              <MaterialIcons name="settings" color={iconColor} size={20} />
            </Pressable>
          )}
        </View>
      </View>

      {mode === 'updates' ? (
        <FlatList
          className="flex-1 pt-3"
          data={visibleFeedItems}
          keyExtractor={(item, index) => item.url + index}
          renderItem={({ item }) => (
            <FeedItem
              bookmark={item}
              channel={item.json.id ? channelMap.get(item.json.id) : undefined}
              onPressChannel={(channel) => setFilterKey(makeChannelFeedFilterKey(channel.id))}
            />
          )}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View className="px-6 py-12">
              <View className="items-center rounded-3xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70 px-5 py-8">
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <MaterialIcons
                    name={updatesEmptyState.icon as any}
                    color={updatesEmptyState.icon === 'rss-feed' ? '#f97316' : iconColor}
                    size={24}
                  />
                </View>
                <NouText className="text-center text-base font-semibold">{updatesEmptyState.title}</NouText>
                <NouText className="mt-2 text-center text-sm leading-6 text-zinc-600 dark:text-zinc-400">{updatesEmptyState.body}</NouText>
                {updatesEmptyState.actions.length ? (
                  <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
                    {updatesEmptyState.actions.map((action) => (
                      <Pressable
                        key={action.key}
                        onPress={action.onPress}
                        disabled={action.disabled}
                        className={clsx(
                          'rounded-full border px-4 py-2',
                          action.tone === 'accent' ? 'border-orange-700 bg-orange-500/10' : 'border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800',
                          action.disabled && 'opacity-60',
                        )}
                      >
                        <View className="flex-row items-center gap-2">
                          {action.loading ? (
                            <ActivityIndicator color={action.tone === 'accent' ? '#fdba74' : iconColor} size="small" />
                          ) : action.icon ? (
                            <MaterialIcons
                              name={action.icon}
                              color={action.tone === 'accent' ? '#fdba74' : iconColor}
                              size={16}
                            />
                          ) : null}
                          <NouText className={clsx('text-sm', action.tone === 'accent' && 'text-orange-200')}>
                            {action.label}
                          </NouText>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          }
        />
      ) : (
        <FlatList
          className="flex-1 pt-3"
          data={visibleManagementItems}
          keyExtractor={(item) => item.channel.id}
          renderItem={({ item }) => (
            <FeedManageItem
              item={item}
              onPress={() => {
                ui$.bookmarkModalBookmark.set(item.channel)
                ui$.bookmarkModalMode.set('feed')
              }}
            />
          )}
          ListEmptyComponent={
            <View className="px-6 py-12">
              <NouText className="text-center text-zinc-600 dark:text-zinc-400">
                {managementItems.length && parsedFilter.kind !== 'all' ? t('feeds.manageNoResults') : t('feeds.manageEmpty')}
              </NouText>
            </View>
          }
        />
      )}

      {activeMenu ? (
        <View className="absolute inset-0 z-20">
          <Pressable className="absolute inset-0" onPress={() => setActiveMenu(undefined)} />
          {activeMenu === 'folder' ? (
            <View
              className={isWeb ? 'absolute right-3 top-[68px] w-[320px] overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900' : 'absolute right-3 top-[68px] w-[320px] overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900'}
              style={{ top: MENU_TOP, maxHeight: 420 }}
            >
              {shouldShowFilterInput ? (
                <View className="border-b border-zinc-300 dark:border-zinc-800 px-3 py-3">
                  <TextInput
                    value={filterMenuQuery}
                    onChangeText={setFilterMenuQuery}
                    placeholder={t('feeds.filterDropdownPlaceholder')}
                    placeholderTextColor={gray.gray11}
                    className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white"
                  />
                </View>
              ) : null}
              <FlatList
                data={visibleMenuItems}
                keyExtractor={(item) => item.key}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={item.onPress}
                    className={
                      index < visibleMenuItems.length - 1
                        ? 'border-b border-zinc-300 dark:border-zinc-800 px-4 py-3 active:bg-zinc-200 dark:active:bg-zinc-800'
                        : 'px-4 py-3 active:bg-zinc-200 dark:active:bg-zinc-800'
                    }
                  >
                    <View className="flex-row items-center gap-3">
                      {renderFilterAvatar(item)}
                      <NouText className="flex-1">{item.label}</NouText>
                      {item.selected ? <MaterialIcons name="check" color={iconColor} size={16} /> : <View className="w-4" />}
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View className="px-4 py-6">
                    <NouText className="text-center text-zinc-600 dark:text-zinc-400">{t('feeds.filterDropdownEmpty')}</NouText>
                  </View>
                }
              />
            </View>
          ) : (
            <View
              className={isWeb ? 'absolute right-3 top-[68px] w-[280px] overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900' : 'absolute right-3 top-[68px] w-[280px] overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900'}
              style={{ top: MENU_TOP }}
            >
              {visibleMenuItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={item.onPress}
                  className={index < visibleMenuItems.length - 1 ? 'border-b border-zinc-300 dark:border-zinc-800 px-4 py-3 active:bg-zinc-200 dark:active:bg-zinc-800' : 'px-4 py-3 active:bg-zinc-200 dark:active:bg-zinc-800'}
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialIcons name={item.icon as any} color={iconColor} size={16} />
                    <NouText className="flex-1">{item.label}</NouText>
                    {item.selected ? <MaterialIcons name="check" color={iconColor} size={16} /> : <View className="w-4" />}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  )

  return nIf(
    feedModalOpen,
    isNarrowNative ? (
      <View className="absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-950">
        <SafeAreaView className="flex-1" edges={['top']}>
          {content}
        </SafeAreaView>
      </View>
    ) : (
      <BaseModal onClose={onClose} className="bg-transparent">
        {content}
      </BaseModal>
    ),
  )
}
