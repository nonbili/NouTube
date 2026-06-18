import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { normalizeI18nLanguage, type SupportedI18nLanguage } from '@/lib/i18n'

export interface SettingsSnapshot {
  language: SupportedI18nLanguage | null
  home: 'yt' | 'yt-music'

  autoHideHeader: boolean
  autoHideSidebar: boolean
  hideToolbarWhenScrolled: boolean
  headerPosition: 'top' | 'bottom'
  feedsEnabled: boolean
  hideShorts: boolean
  hideShortsInNavbar: boolean
  hideMixPlaylist: boolean
  keepHistory: boolean
  miniPlayer: boolean
  preferH264: boolean
  clickbaitThumbnail: 'default' | 'hq1' | 'hq2' | 'hq3'
  playbackRate: number
  playbackQuality: string
  restoreOnStart: boolean
  pullToRefreshEnabled: boolean
  sponsorBlock: boolean
  showDislikes: boolean
  showOriginalVideoTitle: boolean
  showBackButtonInHeader: boolean
  showForwardButtonInHeader: boolean
  showHomeButtonInHeader: boolean
  showReloadButtonInHeader: boolean
  showPlaybackSpeedControl: boolean
  showPlaybackQualityControl: boolean
  userAgent: string
  desktopMode: boolean
  desktopModeYT: boolean
  defaultZoom: number
  theme: null | 'dark' | 'light'
  proxyEnabled: boolean
  proxyType: 'http' | 'socks'
  proxyHost: string
  proxyPort: string
}

interface Store extends SettingsSnapshot {
  downloadPath: string
  lastYtDlpUpdate: number
  setLanguage: (language: SupportedI18nLanguage | null) => void
  isYTMusic: () => boolean
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
  if (typeof data.showDislikes !== 'boolean') {
    data.showDislikes = false
  }
  if (typeof data.showOriginalVideoTitle !== 'boolean') {
    data.showOriginalVideoTitle = false
  }
  if (typeof data.autoHideSidebar !== 'boolean') {
    data.autoHideSidebar = false
  }
  if (typeof data.pullToRefreshEnabled !== 'boolean') {
    data.pullToRefreshEnabled = true
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
  hideToolbarWhenScrolled: Boolean(value?.hideToolbarWhenScrolled),
  headerPosition: value?.headerPosition === 'bottom' ? 'bottom' : 'top',
  feedsEnabled: typeof value?.feedsEnabled === 'boolean' ? value.feedsEnabled : true,
  hideShorts: typeof value?.hideShorts === 'boolean' ? value.hideShorts : true,
  hideShortsInNavbar: Boolean(value?.hideShortsInNavbar),
  hideMixPlaylist: Boolean(value?.hideMixPlaylist),
  keepHistory: typeof value?.keepHistory === 'boolean' ? value.keepHistory : true,
  miniPlayer: typeof value?.miniPlayer === 'boolean' ? value.miniPlayer : true,
  preferH264: Boolean(value?.preferH264),
  clickbaitThumbnail: ['hq1', 'hq2', 'hq3'].includes(value?.clickbaitThumbnail || '')
    ? (value?.clickbaitThumbnail as SettingsSnapshot['clickbaitThumbnail'])
    : 'default',
  playbackRate: typeof value?.playbackRate === 'number' ? value.playbackRate : 1,
  playbackQuality: typeof value?.playbackQuality === 'string' ? value.playbackQuality : 'auto',
  restoreOnStart: typeof value?.restoreOnStart === 'boolean' ? value.restoreOnStart : true,
  pullToRefreshEnabled: typeof value?.pullToRefreshEnabled === 'boolean' ? value.pullToRefreshEnabled : true,
  sponsorBlock: typeof value?.sponsorBlock === 'boolean' ? value.sponsorBlock : true,
  showDislikes: Boolean(value?.showDislikes),
  showOriginalVideoTitle: Boolean(value?.showOriginalVideoTitle),
  showBackButtonInHeader: Boolean(value?.showBackButtonInHeader),
  showForwardButtonInHeader: Boolean(value?.showForwardButtonInHeader),
  showHomeButtonInHeader: Boolean(value?.showHomeButtonInHeader),
  showReloadButtonInHeader: Boolean(value?.showReloadButtonInHeader),
  showPlaybackSpeedControl: Boolean(value?.showPlaybackSpeedControl),
  showPlaybackQualityControl: Boolean(value?.showPlaybackQualityControl),
  userAgent: typeof value?.userAgent === 'string' ? value.userAgent : '',
  desktopMode: Boolean(value?.desktopMode),
  desktopModeYT: Boolean(value?.desktopModeYT),
  defaultZoom: typeof value?.defaultZoom === 'number' ? value.defaultZoom : 100,
  theme: value?.theme === 'dark' || value?.theme === 'light' ? value.theme : null,
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
  hideToolbarWhenScrolled: false,
  headerPosition: 'top',
  feedsEnabled: true,
  hideShorts: true,
  hideShortsInNavbar: false,
  hideMixPlaylist: false,
  keepHistory: true,
  miniPlayer: true,
  preferH264: false,
  clickbaitThumbnail: 'default',
  playbackRate: 1,
  playbackQuality: 'auto',
  restoreOnStart: true,
  pullToRefreshEnabled: true,
  sponsorBlock: true,
  showDislikes: false,
  showOriginalVideoTitle: false,
  showBackButtonInHeader: false,
  showForwardButtonInHeader: false,
  showHomeButtonInHeader: false,
  showReloadButtonInHeader: false,
  showPlaybackSpeedControl: false,
  showPlaybackQualityControl: false,
  userAgent: '',
  desktopMode: false,
  desktopModeYT: false,
  defaultZoom: 100,
  theme: isWeb ? 'dark' : null,
  proxyEnabled: false,
  proxyType: 'http',
  proxyHost: '',
  proxyPort: '',
  downloadPath: '',
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
