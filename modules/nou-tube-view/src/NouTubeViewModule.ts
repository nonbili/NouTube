import { NativeModule, requireNativeModule } from 'expo'

declare class NouTubeViewModule extends NativeModule {
  executeJavaScript(script: string): Promise<string>
  executeJavaScriptAsync(script: string): Promise<string>
  loadUrl(url: string): void
  fetchFeed(url: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  setSettings(settings: {
    proxyEnabled?: boolean
    proxyType?: 'http' | 'socks'
    proxyHost?: string
    proxyPort?: string
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
}

export default requireNativeModule<NouTubeViewModule>('NouTubeView')
