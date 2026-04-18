import { NativeModule, requireNativeModule } from 'expo'

declare class NouTubeViewModule extends NativeModule {
  executeJavaScript(script: string): Promise<string>
  extractTakeoutCsvFiles(uri: string): Promise<Array<{ name: string; uri: string }>>
  setSleepTimer(durationMs: number): Promise<void>
  clearSleepTimer(): Promise<void>
  getSleepTimerRemainingMs(): Promise<number | null>
  listFormats(url: string): Promise<{ title: string; formats: Array<{ formatId: string; label: string; description: string }> }>
  downloadVideo(url: string, formatId: string, outputDir: string): Promise<void>
  getDownloadsPath(): Promise<string>
  updateYtDlp(): Promise<void>
  setLocaleStrings(strings: Record<string, string>): void
}

export default requireNativeModule<NouTubeViewModule>('NouTubeView')
