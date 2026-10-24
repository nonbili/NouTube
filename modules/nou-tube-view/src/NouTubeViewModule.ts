import { NativeModule, requireNativeModule } from 'expo'

declare class NouTubeViewModule extends NativeModule {
  executeJavaScript(script: string): Promise<string>
  executeJavaScriptAsync(script: string): Promise<string>
  /* `startScript` runs as this one document starts, ahead of scriptOnStart.
   * Android only. */
  loadUrl(url: string, startScript?: string): void
  goBack(): Promise<void>
  /* Point the media notification and the system media controls at this view.
   * Only meaningful with more than one view alive (see lib/split-view.ts). */
  claimMediaSession(): Promise<void>
  fetchFeed(url: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  setSettings(settings: {
    proxyEnabled?: boolean
    proxyType?: 'http' | 'socks'
    proxyHost?: string
    proxyPort?: string
    showMediaNotificationPrevButton?: boolean
    showMediaNotificationNextButton?: boolean
    showMediaNotificationRewindButton?: boolean
    showMediaNotificationForwardButton?: boolean
    showMediaNotificationSpeedButton?: boolean
    showMediaNotificationCloseButton?: boolean
    playbackRate?: number
    blockAds?: boolean
    discordPresence?: boolean
  }): void
  extractTakeoutCsvFiles(uri: string): Promise<Array<{ name: string; uri: string }>>
  setSleepTimer(durationMs: number): Promise<void>
  clearSleepTimer(): Promise<void>
  getSleepTimerRemainingMs(): Promise<number | null>
  listFormats(
    url: string,
    useCookies: boolean,
  ): Promise<{ title: string; formats: Array<{ formatId: string; label: string; description: string }> }>
  downloadVideo(url: string, formatId: string, outputDir: string, useCookies: boolean): Promise<void>
  getDownloadsPath(): Promise<string>
  updateYtDlp(): Promise<void>
  setLocaleStrings(strings: Record<string, string>): void
  getSystemCaptionStyle(): {
    enabled: boolean
    fontScale: number
    locale?: string | null
    foregroundColor?: number | null
    backgroundColor?: number | null
    windowColor?: number | null
    edgeType?: number | null
    edgeColor?: number | null
  }
  isSystemDesktopMode(): boolean
  translateText(text: string, targetLanguage: string): Promise<{ text: string; sourceLanguage?: string }>
  getTranslationSupportedLanguages(): string[]
  /* Opens the Discord login and resolves once it is closed. */
  discordLogin(): Promise<{ loggedIn: boolean }>
  discordLogout(): void
  getDiscordStatus(): { loggedIn: boolean }
  /* Android only: notifications without expo-notifications, which the F-Droid
   * build lacks. A tap emits `feedNotificationOpened`. */
  areNotificationsEnabled?(): boolean
  requestNotificationPermission?(): Promise<boolean>
  postNotification?(channelId: string, channelName: string, id: number, title: string, body: string): boolean
  takeFeedNotificationLaunch?(): boolean
}

export default requireNativeModule<NouTubeViewModule>('NouTubeView')
