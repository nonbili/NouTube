import NouTubeViewModule from '@/modules/nou-tube-view'
import type { UpdateCheckResult } from '../desktop/src/main/lib/auto-update'

export type FormatOption = { formatId: string; label: string; description: string }

export interface MainClient {
  clearData(): Promise<void> | void
  toggleInterception(enabled: boolean): Promise<void> | void
  listFormats(url: string, useCookies: boolean): Promise<{ title: string; formats: FormatOption[] }>
  downloadVideo(url: string, formatId: string, outputDir: string, useCookies: boolean): Promise<void>
  getDownloadsPath(): Promise<string>
  selectFolder(): Promise<string | null>
  openFolder(filePath: string): Promise<void> | void
  openFile(filePath: string): Promise<void> | void
  updateYtDlp(): Promise<void>
  fetchFeed(url: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  setCookie(cookie: string): Promise<void>
  setBlocklist(blocklist: unknown): Promise<void> | void
  isUpdateSupported(): Promise<boolean>
  checkForUpdate(): Promise<UpdateCheckResult>
  quitAndInstall(): Promise<void> | void
}

type NouTubeDownloadClient = {
  listFormats?: MainClient['listFormats']
  downloadVideo?: MainClient['downloadVideo']
  getDownloadsPath?: MainClient['getDownloadsPath']
  openFile?: MainClient['openFile']
  updateYtDlp?: MainClient['updateYtDlp']
}

const nativeModule = NouTubeViewModule as NouTubeDownloadClient

export const mainClient: MainClient = {
  async clearData() {},
  async toggleInterception() {},
  async listFormats(url, useCookies) {
    if (typeof nativeModule.listFormats !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.listFormats(url, useCookies)
  },
  async downloadVideo(url, formatId, outputDir, useCookies) {
    if (typeof nativeModule.downloadVideo !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.downloadVideo(url, formatId, outputDir, useCookies)
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
  async openFile(filePath) {
    if (typeof nativeModule.openFile !== 'function') {
      return
    }
    return nativeModule.openFile(filePath)
  },
  async updateYtDlp() {
    if (typeof nativeModule.updateYtDlp !== 'function') {
      return
    }
    return nativeModule.updateYtDlp()
  },
  async fetchFeed(url) {
    // Route through the native module so the request honors the configured proxy;
    // RN's global fetch ignores the WebView ProxyController.
    if (typeof (NouTubeViewModule as { fetchFeed?: unknown }).fetchFeed === 'function') {
      return NouTubeViewModule.fetchFeed(url)
    }
    const res = await fetch(url)
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    }
  },
  async setCookie() {},
  async setBlocklist() {},
  async isUpdateSupported() {
    return false
  },
  async checkForUpdate() {
    return { status: 'not-available' }
  },
  async quitAndInstall() {},
}
