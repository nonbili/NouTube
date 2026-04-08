import NouTubeViewModule from '@/modules/nou-tube-view'

export type FormatOption = { formatId: string; label: string; description: string }

export interface MainClient {
  clearData(): Promise<void> | void
  toggleInterception(enabled: boolean): Promise<void> | void
  listFormats(url: string): Promise<{ title: string; formats: FormatOption[] }>
  downloadVideo(url: string, formatId: string, outputDir: string): Promise<void>
  getDownloadsPath(): Promise<string>
  selectFolder(): Promise<string | null>
  openFolder(filePath: string): Promise<void> | void
  updateYtDlp(): Promise<void>
  fetchFeed(url: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  setCookie(cookie: string): Promise<void>
}

type NouTubeDownloadClient = {
  listFormats?: MainClient['listFormats']
  downloadVideo?: MainClient['downloadVideo']
  getDownloadsPath?: MainClient['getDownloadsPath']
  updateYtDlp?: MainClient['updateYtDlp']
}

const nativeModule = NouTubeViewModule as NouTubeDownloadClient

export const mainClient: MainClient = {
  async clearData() {},
  async toggleInterception() {},
  async listFormats(url) {
    if (typeof nativeModule.listFormats !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.listFormats(url)
  },
  async downloadVideo(url, formatId, outputDir) {
    if (typeof nativeModule.downloadVideo !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.downloadVideo(url, formatId, outputDir)
  },
  async getDownloadsPath() {
    if (typeof nativeModule.getDownloadsPath !== 'function') {
      return ''
    }
    try {
      return await nativeModule.getDownloadsPath()
    } catch {
      return ''
    }
  },
  async selectFolder() {
    return null
  },
  async openFolder() {},
  async updateYtDlp() {
    if (typeof nativeModule.updateYtDlp !== 'function') {
      return
    }
    return nativeModule.updateYtDlp()
  },
  async fetchFeed(url) {
    const res = await fetch(url)
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    }
  },
  async setCookie() {},
}
