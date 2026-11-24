import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import './i18n'
import { tabs$ } from '@/states/tabs'
import { queue$ } from '@/states/queue'
import {
  isTabControllable,
  isYtMusicUrl,
  resolveTaskbarTarget,
  taskbarControls,
  type TabPlaybackState,
} from './taskbar-controls'

function makeTab(overrides: Partial<TabPlaybackState> & { tabId: string }): TabPlaybackState {
  return {
    pageUrl: 'https://www.youtube.com/',
    playing: false,
    hasVideo: false,
    updatedAt: 0,
    ...overrides,
  }
}

describe('isYtMusicUrl', () => {
  test('identifies YouTube Music URLs', () => {
    expect(isYtMusicUrl('https://music.youtube.com/')).toBe(true)
    expect(isYtMusicUrl('https://music.youtube.com/library')).toBe(true)
    expect(isYtMusicUrl('https://www.youtube.com/')).toBe(false)
    expect(isYtMusicUrl('not-a-url')).toBe(false)
  })
})

describe('isTabControllable', () => {
  test('is false on YouTube home with nothing playing', () => {
    expect(isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/' }))).toBe(false)
    expect(isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/feed/subscriptions' }))).toBe(
      false,
    )
    expect(isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/watch' }))).toBe(false)
  })

  test('is true on YouTube home when miniplayer is actively playing', () => {
    expect(isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/', playing: true }))).toBe(true)
  })

  test('is true on paused watch and shorts pages', () => {
    expect(
      isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/watch?v=abc', playing: false })),
    ).toBe(true)
    expect(
      isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/shorts/abc123', playing: false })),
    ).toBe(true)
  })

  test('is false on YouTube Music home before a track is loaded, true once loaded', () => {
    expect(
      isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://music.youtube.com/', hasVideo: false })),
    ).toBe(false)
    expect(
      isTabControllable(makeTab({ tabId: 't1', pageUrl: 'https://music.youtube.com/', hasVideo: true })),
    ).toBe(true)
  })
})

describe('resolveTaskbarTarget', () => {
  test('disables buttons when user is on home screen with no video', () => {
    const tabs = [makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/' })]
    expect(resolveTaskbarTarget(tabs, 't1', undefined)).toEqual({
      targetTabId: undefined,
      state: { enabled: false, playing: false },
    })
  })

  test('enables play/pause on active watch tab', () => {
    const tabs = [
      makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/watch?v=abc', playing: true, hasVideo: true }),
    ]
    expect(resolveTaskbarTarget(tabs, 't1', undefined)).toEqual({
      targetTabId: 't1',
      state: { enabled: true, playing: true },
    })
  })

  test('targets a background playing tab when active tab is on home', () => {
    const tabs = [
      makeTab({
        tabId: 't1',
        pageUrl: 'https://music.youtube.com/',
        playing: true,
        hasVideo: true,
        updatedAt: 100,
      }),
      makeTab({ tabId: 't2', pageUrl: 'https://www.youtube.com/' }),
    ]
    expect(resolveTaskbarTarget(tabs, 't2', undefined)).toEqual({
      targetTabId: 't1',
      state: { enabled: true, playing: true },
    })
  })

  test('picks the most recently updated playing tab when multiple background tabs play', () => {
    const tabs = [
      makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/watch?v=1', playing: true, updatedAt: 100 }),
      makeTab({ tabId: 't2', pageUrl: 'https://www.youtube.com/watch?v=2', playing: true, updatedAt: 200 }),
      makeTab({ tabId: 't3', pageUrl: 'https://www.youtube.com/' }),
    ]
    expect(resolveTaskbarTarget(tabs, 't3', undefined)).toEqual({
      targetTabId: 't2',
      state: { enabled: true, playing: true },
    })
  })

  test('keeps preferred paused background tab controllable when active tab is home', () => {
    const tabs = [
      makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/watch?v=1', playing: false, hasVideo: true }),
      makeTab({ tabId: 't2', pageUrl: 'https://www.youtube.com/' }),
    ]
    expect(resolveTaskbarTarget(tabs, 't2', 't1')).toEqual({
      targetTabId: 't1',
      state: { enabled: true, playing: false },
    })
  })

  test('disables buttons when preferred tab navigates back to home', () => {
    const tabs = [
      makeTab({ tabId: 't1', pageUrl: 'https://www.youtube.com/', playing: false, hasVideo: true }),
      makeTab({ tabId: 't2', pageUrl: 'https://www.youtube.com/' }),
    ]
    expect(resolveTaskbarTarget(tabs, 't2', 't1')).toEqual({
      targetTabId: undefined,
      state: { enabled: false, playing: false },
    })
  })
})

describe('taskbarControls actions', () => {
  const originalWindow = (globalThis as any).window
  const ipcInvoke = mock(async () => {})
  const executed: string[] = []
  let canGoBack = true
  const goBack = mock(() => {})
  const fakeWebview = {
    executeJavaScript: mock(async (code: string) => {
      executed.push(code)
      return ''
    }),
    canGoBack: () => canGoBack,
    goBack,
  }

  beforeEach(() => {
    ;(globalThis as any).window = { electron: { ipcRenderer: { invoke: ipcInvoke } } }
    ipcInvoke.mockClear()
    executed.length = 0
    canGoBack = true
    goBack.mockClear()
    fakeWebview.executeJavaScript.mockClear()
    queue$.bookmarks.set([])
    tabs$.tabs.set([
      {
        id: 'tab-prev-test',
        url: 'https://www.youtube.com/watch?v=videoA',
        pageUrl: 'https://www.youtube.com/watch?v=videoA',
      },
    ])
    tabs$.activeTabIndex.set(0)
    taskbarControls.removeTab('tab-prev-test')
    taskbarControls.registerTabWebview('tab-prev-test', fakeWebview)
    taskbarControls.setActiveTab('tab-prev-test')
  })

  afterEach(() => {
    taskbarControls.removeTab('tab-prev-test')
    ;(globalThis as any).window = originalWindow
  })

  test('uses webview.goBack() for instant SPA back to the previous watch video outside playlists', async () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoA')
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoB')

    await taskbarControls.runAction('previous')

    expect(goBack).toHaveBeenCalledTimes(1)
    expect(executed).toEqual([])
  })

  test('does not lose history if goBack() does not navigate and user opens another video', async () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoA')
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoB')

    // Suppose goBack() is a no-op, and user later navigates to videoC instead of videoA.
    await taskbarControls.runAction('previous')
    expect(goBack).toHaveBeenCalledTimes(1)

    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoC')
    await taskbarControls.runAction('previous')
    expect(goBack).toHaveBeenCalledTimes(2)
  })

  test('does not use goBack() on Shorts pages', async () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/shorts/shortA')
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/shorts/shortB')

    await taskbarControls.runAction('previous')

    expect(goBack).not.toHaveBeenCalled()
    expect(executed).toEqual(['window.NouTube?.prev?.()'])
  })

  test('does not go back to home screen when no previous video was watched', async () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/')
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoA')

    await taskbarControls.runAction('previous')

    expect(goBack).not.toHaveBeenCalled()
    expect(executed).toEqual(['window.NouTube?.prev?.()'])
  })

  test('delegates to NouTube.prev() inside playlists', async () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoA&list=PL123')
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoB&list=PL123')

    await taskbarControls.runAction('previous')

    expect(goBack).not.toHaveBeenCalled()
    expect(executed).toEqual(['window.NouTube?.prev?.()'])
  })

  test('skips to next in page when queue is empty', async () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoA')

    await taskbarControls.runAction('next')

    expect(executed).toContain('window.NouTube?.skipToNext?.()')
  })

  test('sends localized tooltip labels with setTaskbarControls', () => {
    taskbarControls.setTabUrl('tab-prev-test', 'https://www.youtube.com/watch?v=videoA')
    expect(ipcInvoke).toHaveBeenLastCalledWith('channel:main', 'setTaskbarControls', {
      enabled: true,
      playing: false,
      labels: {
        previous: 'Previous',
        play: 'Play',
        pause: 'Pause',
        next: 'Next',
      },
    })
  })
})
