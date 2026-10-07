import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { normalizeI18nLanguage, type SupportedI18nLanguage } from '@/lib/i18n'
import type { DownloadPreset } from '@/lib/download-format'

export interface SettingsSnapshot {
  language: SupportedI18nLanguage | null
  home: 'yt' | 'yt-music'

  autoHideHeader: boolean
  autoHideSidebar: boolean
  doubleTapToToggleHeader: boolean
  translateComments: boolean
  translationTargetLanguage: string | null
  hideToolbarWhenScrolled: boolean
  headerPosition: 'top' | 'bottom'
  feedsEnabled: boolean
  feedNotificationsEnabled: boolean
  hideShorts: boolean
  hideShortsInNavbar: boolean
  hideMixPlaylist: boolean
  keepHistory: boolean
  replaceWatchNavigation: boolean
  miniPlayer: boolean
  // Where the mini player was last dropped, as fractions of the room it can
  // move in, so it lands in the same spot after a rotation or resize.
  miniPlayerPosition: { x: number; y: number }
  pictureInPicture: boolean
  preferH264: boolean
  clickbaitThumbnail: 'default' | 'hq1' | 'hq2' | 'hq3'
  playbackRate: number
  playbackQuality: string
  restoreOnStart: boolean
  pullToRefreshEnabled: boolean
  sponsorBlock: boolean
  blockAds: boolean
  discordPresence: boolean
  showDislikes: boolean
  showOriginalVideoTitle: boolean
  useSystemCaptionStyle: boolean
  showBackButtonInHeader: boolean
  showForwardButtonInHeader: boolean
  showHomeButtonInHeader: boolean
  showHistoryButtonInHeader: boolean
  showReloadButtonInHeader: boolean
  showPlaybackSpeedControl: boolean
  showPlaybackQualityControl: boolean
  showSleepTimerButtonInHeader: boolean
  showLibraryButtonInHeader: boolean
  showStarButtonInHeader: boolean
  showMediaNotificationPrevButton: boolean
  showMediaNotificationNextButton: boolean
  showMediaNotificationRewindButton: boolean
  showMediaNotificationForwardButton: boolean
  showMediaNotificationSpeedButton: boolean
  showMediaNotificationCloseButton: boolean
  userAgent: string
  desktopMode: boolean
  desktopModeYT: boolean
  defaultZoom: number
  theme: null | 'dark' | 'light'
  dynamicColor: boolean
  proxyEnabled: boolean
  proxyType: 'http' | 'socks'
  proxyHost: string
  proxyPort: string
}

interface Store extends SettingsSnapshot {
  downloadPath: string
  downloadUseCookies: boolean
  downloadPresets: DownloadPreset[]
  lastYtDlpUpdate: number
  setLanguage: (language: SupportedI18nLanguage | null) => void
  isYTMusic: () => boolean
}

const clampFraction = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback

/* Earlier versions only snapped to corners; carry that choice over. */
const getMiniPlayerPosition = (value: Partial<Store> | undefined): SettingsSnapshot['miniPlayerPosition'] => {
  const corner = (value as { miniPlayerCorner?: unknown } | undefined)?.miniPlayerCorner
  const fallback = {
    x: typeof corner === 'string' && corner.endsWith('left') ? 0 : 1,
    y: typeof corner === 'string' && corner.startsWith('top') ? 0 : 1,
  }
  const position = value?.miniPlayerPosition
  return {
    x: clampFraction(position?.x, fallback.x),
    y: clampFraction(position?.y, fallback.y),
  }
}

export const normalizeSettings = <T extends Partial<SettingsSnapshot> | undefined>(data: T) => {
  if (!data) {
    return data
  }
  data.language = normalizeI18nLanguage(data.language)
  if (data.headerPosition !== 'bottom') {
    data.headerPosition = 'top'
  }
  if (typeof data.showHomeButtonInHeader !== 'boolean') {
    data.showHomeButtonInHeader = false
  }
  if (typeof data.showHistoryButtonInHeader !== 'boolean') {
    data.showHistoryButtonInHeader = false
  }
  if (typeof data.showBackButtonInHeader !== 'boolean') {
    data.showBackButtonInHeader = false
  }
  if (typeof data.showForwardButtonInHeader !== 'boolean') {
    data.showForwardButtonInHeader = false
  }
  if (typeof data.showReloadButtonInHeader !== 'boolean') {
    data.showReloadButtonInHeader = false
  }
  if (typeof data.playbackQuality !== 'string') {
    data.playbackQuality = 'auto'
  }
  if (typeof data.showPlaybackQualityControl !== 'boolean') {
    data.showPlaybackQualityControl = false
  }
  if (typeof data.showSleepTimerButtonInHeader !== 'boolean') {
    data.showSleepTimerButtonInHeader = false
  }
  if (typeof data.showLibraryButtonInHeader !== 'boolean') {
    data.showLibraryButtonInHeader = true
  }
  if (typeof data.showStarButtonInHeader !== 'boolean') {
    data.showStarButtonInHeader = true
  }
  if (typeof data.showMediaNotificationPrevButton !== 'boolean') {
    data.showMediaNotificationPrevButton = true
  }
  if (typeof data.showMediaNotificationNextButton !== 'boolean') {
    data.showMediaNotificationNextButton = true
  }
  if (typeof data.showMediaNotificationRewindButton !== 'boolean') {
    data.showMediaNotificationRewindButton = true
  }
  if (typeof data.showMediaNotificationForwardButton !== 'boolean') {
    data.showMediaNotificationForwardButton = true
  }
  if (typeof data.showMediaNotificationSpeedButton !== 'boolean') {
    data.showMediaNotificationSpeedButton = false
  }
  if (typeof data.showMediaNotificationCloseButton !== 'boolean') {
    data.showMediaNotificationCloseButton = false
  }
  if (typeof data.blockAds !== 'boolean') {
    data.blockAds = true
  }
  if (typeof data.discordPresence !== 'boolean') {
    data.discordPresence = false
  }
  if (typeof data.showDislikes !== 'boolean') {
    data.showDislikes = false
  }
  if (typeof data.showOriginalVideoTitle !== 'boolean') {
    data.showOriginalVideoTitle = false
  }
  if (typeof data.useSystemCaptionStyle !== 'boolean') {
    data.useSystemCaptionStyle = false
  }
  if (typeof data.autoHideSidebar !== 'boolean') {
    data.autoHideSidebar = false
  }
  if (typeof data.doubleTapToToggleHeader !== 'boolean') {
    data.doubleTapToToggleHeader = false
  }
  if (typeof data.translateComments !== 'boolean') {
    data.translateComments = false
  }
  if (typeof data.translationTargetLanguage !== 'string' || !data.translationTargetLanguage.trim()) {
    data.translationTargetLanguage = null
  }
  if (typeof data.pullToRefreshEnabled !== 'boolean') {
    data.pullToRefreshEnabled = true
  }
  if (typeof data.replaceWatchNavigation !== 'boolean') {
    data.replaceWatchNavigation = false
  }
  if (typeof data.miniPlayer !== 'boolean') {
    data.miniPlayer = false
  }
  // PlayerFrame reads this one straight out of the store and does arithmetic
  // on it, so anything unexpected has to be replaced, not defaulted.
  data.miniPlayerPosition = getMiniPlayerPosition(data)
  delete (data as { miniPlayerCorner?: unknown }).miniPlayerCorner
  if (typeof data.pictureInPicture !== 'boolean') {
    data.pictureInPicture = false
  }
  if (typeof data.proxyEnabled !== 'boolean') {
    data.proxyEnabled = false
  }
  if (data.proxyType !== 'http' && data.proxyType !== 'socks') {
    data.proxyType = 'http'
  }
  if (typeof data.proxyHost !== 'string') {
    data.proxyHost = ''
  }
  if (typeof data.proxyPort !== 'string') {
    data.proxyPort = ''
  }
  if (typeof data.defaultZoom !== 'number') {
    data.defaultZoom = 100
  }
  return data
}

export const getSettingsSnapshot = (value: Partial<Store> | undefined = settings$.get()): SettingsSnapshot => ({
  language: normalizeI18nLanguage(value?.language),
  home: value?.home === 'yt-music' ? 'yt-music' : 'yt',

  autoHideHeader: Boolean(value?.autoHideHeader),
  autoHideSidebar: Boolean(value?.autoHideSidebar),
  doubleTapToToggleHeader: Boolean(value?.doubleTapToToggleHeader),
  translateComments: Boolean(value?.translateComments),
  translationTargetLanguage:
    typeof value?.translationTargetLanguage === 'string' && value.translationTargetLanguage.trim()
      ? value.translationTargetLanguage
      : null,
  hideToolbarWhenScrolled: Boolean(value?.hideToolbarWhenScrolled),
  headerPosition: value?.headerPosition === 'bottom' ? 'bottom' : 'top',
  feedsEnabled: typeof value?.feedsEnabled === 'boolean' ? value.feedsEnabled : true,
  feedNotificationsEnabled: Boolean(value?.feedNotificationsEnabled),
  hideShorts: typeof value?.hideShorts === 'boolean' ? value.hideShorts : true,
  hideShortsInNavbar: Boolean(value?.hideShortsInNavbar),
  hideMixPlaylist: Boolean(value?.hideMixPlaylist),
  keepHistory: typeof value?.keepHistory === 'boolean' ? value.keepHistory : true,
  replaceWatchNavigation: Boolean(value?.replaceWatchNavigation),
  miniPlayer: typeof value?.miniPlayer === 'boolean' ? value.miniPlayer : false,
  miniPlayerPosition: getMiniPlayerPosition(value),
  pictureInPicture: Boolean(value?.pictureInPicture),
  preferH264: Boolean(value?.preferH264),
  clickbaitThumbnail: ['hq1', 'hq2', 'hq3'].includes(value?.clickbaitThumbnail || '')
    ? (value?.clickbaitThumbnail as SettingsSnapshot['clickbaitThumbnail'])
    : 'default',
  playbackRate: typeof value?.playbackRate === 'number' ? value.playbackRate : 1,
  playbackQuality: typeof value?.playbackQuality === 'string' ? value.playbackQuality : 'auto',
  restoreOnStart: typeof value?.restoreOnStart === 'boolean' ? value.restoreOnStart : false,
  pullToRefreshEnabled: typeof value?.pullToRefreshEnabled === 'boolean' ? value.pullToRefreshEnabled : true,
  sponsorBlock: typeof value?.sponsorBlock === 'boolean' ? value.sponsorBlock : true,
  blockAds: typeof value?.blockAds === 'boolean' ? value.blockAds : true,
  discordPresence: Boolean(value?.discordPresence),
  showDislikes: Boolean(value?.showDislikes),
  showOriginalVideoTitle: Boolean(value?.showOriginalVideoTitle),
  useSystemCaptionStyle: Boolean(value?.useSystemCaptionStyle),
  showBackButtonInHeader: Boolean(value?.showBackButtonInHeader),
  showForwardButtonInHeader: Boolean(value?.showForwardButtonInHeader),
  showHomeButtonInHeader: Boolean(value?.showHomeButtonInHeader),
  showHistoryButtonInHeader: Boolean(value?.showHistoryButtonInHeader),
  showReloadButtonInHeader: Boolean(value?.showReloadButtonInHeader),
  showPlaybackSpeedControl: Boolean(value?.showPlaybackSpeedControl),
  showPlaybackQualityControl: Boolean(value?.showPlaybackQualityControl),
  showSleepTimerButtonInHeader: Boolean(value?.showSleepTimerButtonInHeader),
  showLibraryButtonInHeader:
    typeof value?.showLibraryButtonInHeader === 'boolean' ? value.showLibraryButtonInHeader : true,
  showStarButtonInHeader: typeof value?.showStarButtonInHeader === 'boolean' ? value.showStarButtonInHeader : true,
  showMediaNotificationPrevButton:
    typeof value?.showMediaNotificationPrevButton === 'boolean' ? value.showMediaNotificationPrevButton : true,
  showMediaNotificationNextButton:
    typeof value?.showMediaNotificationNextButton === 'boolean' ? value.showMediaNotificationNextButton : true,
  showMediaNotificationRewindButton:
    typeof value?.showMediaNotificationRewindButton === 'boolean' ? value.showMediaNotificationRewindButton : true,
  showMediaNotificationForwardButton:
    typeof value?.showMediaNotificationForwardButton === 'boolean' ? value.showMediaNotificationForwardButton : true,
  showMediaNotificationSpeedButton: Boolean(value?.showMediaNotificationSpeedButton),
  showMediaNotificationCloseButton: Boolean(value?.showMediaNotificationCloseButton),
  userAgent: typeof value?.userAgent === 'string' ? value.userAgent : '',
  desktopMode: Boolean(value?.desktopMode),
  desktopModeYT: Boolean(value?.desktopModeYT),
  defaultZoom: typeof value?.defaultZoom === 'number' ? value.defaultZoom : 100,
  theme: value?.theme === 'dark' || value?.theme === 'light' ? value.theme : null,
  dynamicColor: typeof value?.dynamicColor === 'boolean' ? value.dynamicColor : true,
  proxyEnabled: Boolean(value?.proxyEnabled),
  proxyType: value?.proxyType === 'socks' ? 'socks' : 'http',
  proxyHost: typeof value?.proxyHost === 'string' ? value.proxyHost : '',
  proxyPort: typeof value?.proxyPort === 'string' ? value.proxyPort : '',
})

export const settings$ = observable<Store>({
  language: null,
  setLanguage: (language) => {
    settings$.language.set(normalizeI18nLanguage(language))
  },
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() === 'yt-music',

  autoHideHeader: false,
  autoHideSidebar: false,
  doubleTapToToggleHeader: false,
  translateComments: false,
  translationTargetLanguage: null,
  hideToolbarWhenScrolled: false,
  headerPosition: 'top',
  feedsEnabled: true,
  feedNotificationsEnabled: false,
  hideShorts: true,
  hideShortsInNavbar: false,
  hideMixPlaylist: false,
  keepHistory: true,
  replaceWatchNavigation: false,
  miniPlayer: false,
  miniPlayerPosition: { x: 1, y: 1 },
  pictureInPicture: false,
  preferH264: false,
  clickbaitThumbnail: 'default',
  playbackRate: 1,
  playbackQuality: 'auto',
  restoreOnStart: false,
  pullToRefreshEnabled: true,
  sponsorBlock: true,
  blockAds: true,
  discordPresence: false,
  showDislikes: false,
  showOriginalVideoTitle: false,
  useSystemCaptionStyle: false,
  showBackButtonInHeader: false,
  showForwardButtonInHeader: false,
  showHomeButtonInHeader: false,
  showHistoryButtonInHeader: false,
  showReloadButtonInHeader: false,
  showPlaybackSpeedControl: false,
  showPlaybackQualityControl: false,
  showSleepTimerButtonInHeader: false,
  showLibraryButtonInHeader: true,
  showStarButtonInHeader: true,
  showMediaNotificationPrevButton: true,
  showMediaNotificationNextButton: true,
  showMediaNotificationRewindButton: true,
  showMediaNotificationForwardButton: true,
  showMediaNotificationSpeedButton: false,
  showMediaNotificationCloseButton: false,
  userAgent: '',
  desktopMode: false,
  desktopModeYT: false,
  defaultZoom: 100,
  theme: isWeb ? 'dark' : null,
  dynamicColor: true,
  proxyEnabled: false,
  proxyType: 'http',
  proxyHost: '',
  proxyPort: '',
  downloadPath: '',
  downloadUseCookies: false,
  downloadPresets: [],
  lastYtDlpUpdate: 0,
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: ObservablePersistMMKV,
    transform: {
      load: (data: Store) => normalizeSettings(data),
    },
  },
})

export const ZOOM_PRESETS = [50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300]
