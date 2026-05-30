import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { normalizeI18nLanguage, type SupportedI18nLanguage } from '@/lib/i18n'

interface Store {
  language: SupportedI18nLanguage | null
  setLanguage: (language: SupportedI18nLanguage | null) => void
  home: 'yt' | 'yt-music'
  isYTMusic: () => boolean

  autoHideHeader: boolean
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
  sponsorBlock: boolean
  showBackButtonInHeader: boolean
  showForwardButtonInHeader: boolean
  showHomeButtonInHeader: boolean
  showPlaybackSpeedControl: boolean
  showPlaybackQualityControl: boolean
  userAgent: string
  desktopMode: boolean
  desktopModeYT: boolean
  theme: null | 'dark' | 'light'
  downloadPath: string
  lastYtDlpUpdate: number
}

const normalizeSettings = <T extends Partial<Store> | undefined>(data: T) => {
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
  if (typeof data.playbackQuality !== 'string') {
    data.playbackQuality = 'auto'
  }
  if (typeof data.showPlaybackQualityControl !== 'boolean') {
    data.showPlaybackQualityControl = false
  }
  return data
}

export const settings$ = observable<Store>({
  language: null,
  setLanguage: (language) => {
    settings$.language.set(normalizeI18nLanguage(language))
  },
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() === 'yt-music',

  autoHideHeader: false,
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
  sponsorBlock: true,
  showBackButtonInHeader: false,
  showForwardButtonInHeader: false,
  showHomeButtonInHeader: false,
  showPlaybackSpeedControl: false,
  showPlaybackQualityControl: false,
  userAgent: '',
  desktopMode: false,
  desktopModeYT: false,
  theme: isWeb ? 'dark' : null,
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
