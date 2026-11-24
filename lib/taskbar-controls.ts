import i18next, { t } from 'i18next'
import { mainClient } from '@/lib/main-client'
import { getVideoIdFromUrl } from '@/lib/last-playing'
import { advanceQueue } from '@/lib/queue'
import { isWatchUrl } from '@/lib/split-watch-url'
import { tabs$ } from '@/states/tabs'

export type TaskbarControlAction = 'previous' | 'play-pause' | 'next'

export interface TaskbarControlLabels {
  previous: string
  play: string
  pause: string
  next: string
}

export interface TaskbarControlsState {
  enabled: boolean
  playing: boolean
  labels?: TaskbarControlLabels
}

export interface TabPlaybackState {
  tabId: string
  pageUrl: string
  playing: boolean
  hasVideo: boolean
  updatedAt: number
  // Watch pages this tab played before the current one, oldest first. Only
  // regular /watch pages: Shorts replace their history entry while scrolling,
  // so they would not line up with webview.goBack().
  watchHistory?: string[]
}

const MAX_WATCH_HISTORY = 50

interface ExecutableWebview {
  executeJavaScript: (code: string) => Promise<unknown>
  canGoBack?: () => boolean
  goBack?: () => void
}

export function isYtMusicUrl(url: string): boolean {
  try {
    return new URL(url).host === 'music.youtube.com'
  } catch {
    return false
  }
}

function isShortsUrl(url: string): boolean {
  try {
    const { host, pathname } = new URL(url)
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) && pathname.startsWith('/shorts/')
  } catch {
    return false
  }
}

/** The video of a regular www/m.youtube.com watch page, '' for anything else. */
function getWatchVideoId(url: string | undefined): string {
  return url && isWatchUrl(url) ? getVideoIdFromUrl(url) : ''
}

export function isTabControllable(tab: TabPlaybackState): boolean {
  if (tab.playing || getWatchVideoId(tab.pageUrl) || isShortsUrl(tab.pageUrl)) {
    return true
  }
  // YouTube Music keeps its player bar on every page once a song is loaded.
  return isYtMusicUrl(tab.pageUrl) && tab.hasVideo
}

export function resolveTaskbarTarget(
  tabs: TabPlaybackState[],
  activeTabId: string | undefined,
  preferredTabId: string | undefined,
): { targetTabId: string | undefined; state: TaskbarControlsState } {
  const activeTab = activeTabId ? tabs.find((tab) => tab.tabId === activeTabId) : undefined
  if (activeTab?.playing) {
    return { targetTabId: activeTab.tabId, state: { enabled: true, playing: true } }
  }

  let latestPlaying: TabPlaybackState | undefined
  for (const tab of tabs) {
    if (tab.playing && (!latestPlaying || tab.updatedAt >= latestPlaying.updatedAt)) {
      latestPlaying = tab
    }
  }
  if (latestPlaying) {
    return { targetTabId: latestPlaying.tabId, state: { enabled: true, playing: true } }
  }

  if (activeTab && isTabControllable(activeTab)) {
    return { targetTabId: activeTab.tabId, state: { enabled: true, playing: false } }
  }

  const preferredTab = preferredTabId ? tabs.find((tab) => tab.tabId === preferredTabId) : undefined
  if (preferredTab && isTabControllable(preferredTab)) {
    return { targetTabId: preferredTab.tabId, state: { enabled: true, playing: false } }
  }

  return { targetTabId: undefined, state: { enabled: false, playing: false } }
}

const tabStates = new Map<string, TabPlaybackState>()
const tabWebviews = new Map<string, ExecutableWebview>()
// The video a tab is expected to land on after goBack(), so that arriving
// there is not recorded as moving forward.
const pendingBack = new Map<string, string>()
let activeTabId: string | undefined
let preferredTabId: string | undefined
let lastSent = ''

function getLabels(): TaskbarControlLabels {
  return {
    previous: t('taskbar.previous'),
    play: t('taskbar.play'),
    pause: t('taskbar.pause'),
    next: t('taskbar.next'),
  }
}

function executeQuietly(webview: ExecutableWebview | undefined, script: string): void {
  try {
    void webview?.executeJavaScript(script).catch?.(() => undefined)
  } catch {}
}

function sync(): void {
  const { targetTabId, state } = resolveTaskbarTarget(Array.from(tabStates.values()), activeTabId, preferredTabId)
  if (targetTabId && state.playing) {
    preferredTabId = targetTabId
  } else if (preferredTabId) {
    const preferred = tabStates.get(preferredTabId)
    if (!preferred || !isTabControllable(preferred)) {
      preferredTabId = undefined
    }
  }

  const next = { ...state, labels: getLabels() }
  const key = JSON.stringify(next)
  if (key === lastSent) {
    return
  }
  lastSent = key
  void mainClient.setTaskbarControls(next)
}

i18next.on?.('languageChanged', sync)

function findTabIndex(tabId: string): number {
  return tabs$.tabs.get().findIndex((tab) => tab.id === tabId)
}

async function playNext(tabId: string, webview: ExecutableWebview): Promise<void> {
  const pageUrl = tabStates.get(tabId)?.pageUrl || ''
  // The page url stops naming the video once the user browses away from it
  // with the player still going, so prefer the player's own.
  const videoUrl = String((await webview.executeJavaScript('window.NouTube?.getVideoUrl?.() || ""').catch(() => '')) ?? '')
  const endedUrl = videoUrl.includes('v=') ? videoUrl : pageUrl
  const nextUrl = endedUrl ? advanceQueue(endedUrl, { manual: true, ytMusic: isYtMusicUrl(pageUrl) }) : undefined
  const tabIndex = findTabIndex(tabId)
  if (nextUrl && tabIndex >= 0) {
    tabs$.updateTabUrl(nextUrl, tabIndex)
  } else {
    // Straight to the page: NouTube.next() would consult the queue again.
    executeQuietly(webview, 'window.NouTube?.skipToNext?.()')
  }
}

function playPrevious(tabId: string, webview: ExecutableWebview): void {
  const tabState = tabStates.get(tabId)
  const pageUrl = tabState?.pageUrl || ''
  const history = tabState?.watchHistory
  const target = history?.at(-1)
  // YouTube's previousVideo() does nothing on a watch page outside a playlist,
  // so step back through the tab's own history instead -- an in-page
  // navigation, unlike loading the url again. Playlists and YouTube Music know
  // their previous track themselves.
  if (getWatchVideoId(pageUrl) && !pageUrl.includes('list=') && history && target && webview.canGoBack?.()) {
    history.pop()
    pendingBack.set(tabId, getWatchVideoId(target))
    webview.goBack?.()
    return
  }
  executeQuietly(webview, 'window.NouTube?.prev?.()')
}

export const taskbarControls = {
  registerTabWebview(tabId: string, webview: ExecutableWebview | null): void {
    if (webview) {
      tabWebviews.set(tabId, webview)
    } else {
      tabWebviews.delete(tabId)
    }
  },

  setTabUrl(tabId: string, pageUrl: string, options: { resetPlayback?: boolean } = {}): void {
    const prev = tabStates.get(tabId)
    let watchHistory = prev?.watchHistory ?? []
    const prevVideoId = getWatchVideoId(prev?.pageUrl)
    const nextVideoId = getWatchVideoId(pageUrl)

    if (!nextVideoId) {
      // Leaving watch pages (Home, a channel, Shorts) ends the run of videos
      // goBack() can return through.
      watchHistory = []
      pendingBack.delete(tabId)
    } else if (prevVideoId && prevVideoId !== nextVideoId) {
      const expected = pendingBack.get(tabId)
      pendingBack.delete(tabId)
      if (expected !== nextVideoId && getWatchVideoId(watchHistory.at(-1)) !== prevVideoId) {
        watchHistory = [...watchHistory, prev!.pageUrl].slice(-MAX_WATCH_HISTORY)
      }
    }

    tabStates.set(tabId, {
      tabId,
      pageUrl,
      playing: options.resetPlayback ? false : (prev?.playing ?? false),
      hasVideo: options.resetPlayback ? false : (prev?.hasVideo ?? false),
      updatedAt: prev?.updatedAt ?? 0,
      watchHistory,
    })
    sync()
  },

  reportTabPlayback(tabId: string, playing: boolean, hasVideo = true): void {
    const prev = tabStates.get(tabId)
    tabStates.set(tabId, {
      tabId,
      pageUrl: prev?.pageUrl ?? '',
      playing,
      hasVideo,
      updatedAt: Date.now(),
      watchHistory: prev?.watchHistory,
    })
    if (playing) {
      preferredTabId = tabId
    }
    sync()
  },

  removeTab(tabId: string): void {
    tabStates.delete(tabId)
    tabWebviews.delete(tabId)
    pendingBack.delete(tabId)
    if (preferredTabId === tabId) {
      preferredTabId = undefined
    }
    sync()
  },

  setActiveTab(tabId: string | undefined): void {
    activeTabId = tabId
    sync()
  },

  async runAction(action: TaskbarControlAction): Promise<void> {
    const { targetTabId, state } = resolveTaskbarTarget(Array.from(tabStates.values()), activeTabId, preferredTabId)
    const webview = targetTabId ? tabWebviews.get(targetTabId) : undefined
    if (!targetTabId || !state.enabled || !webview) {
      return
    }
    preferredTabId = targetTabId

    switch (action) {
      case 'play-pause':
        executeQuietly(webview, state.playing ? 'window.NouTube?.pause?.()' : 'window.NouTube?.play?.()')
        break
      case 'previous':
        playPrevious(targetTabId, webview)
        break
      case 'next':
        await playNext(targetTabId, webview)
        break
    }
  },
}
