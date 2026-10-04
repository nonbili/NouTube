import NouTubeViewModule from '@/modules/nou-tube-view'
import { settings$ } from '@/states/settings'

export const syncNativeSettings = () => {
  const settings = settings$.get()
  NouTubeViewModule.setSettings({
    proxyEnabled: settings.proxyEnabled,
    proxyType: settings.proxyType,
    proxyHost: settings.proxyHost,
    proxyPort: settings.proxyPort,
    showMediaNotificationPrevButton: settings.showMediaNotificationPrevButton,
    showMediaNotificationNextButton: settings.showMediaNotificationNextButton,
    showMediaNotificationRewindButton: settings.showMediaNotificationRewindButton,
    showMediaNotificationForwardButton: settings.showMediaNotificationForwardButton,
    showMediaNotificationSpeedButton: settings.showMediaNotificationSpeedButton,
    showMediaNotificationCloseButton: settings.showMediaNotificationCloseButton,
    playbackRate: settings.playbackRate,
    blockAds: settings.blockAds,
  })
}

