import { beforeEach, describe, expect, it } from 'bun:test'
import { history$ } from './history'
import { resumeLastPlayingTab, tabs$ } from './tabs'

const VIDEO_URL = 'https://www.youtube.com/watch?v=abc123'

const setLastPlaying = (current: number) => {
  history$.bookmarks.set([
    {
      id: 'last',
      videoId: 'abc123',
      url: VIDEO_URL,
      title: 'last',
      duration: 600,
      current,
      updatedAt: Date.now(),
    },
  ])
}

const setTabs = (urls: string[], activeTabIndex = 0) => {
  tabs$.tabs.set(urls.map((url, i) => ({ id: `tab${i}`, url, pageUrl: url })))
  tabs$.activeTabIndex.set(activeTabIndex)
}

describe('resumeLastPlayingTab', () => {
  beforeEach(() => {
    setLastPlaying(120)
  })

  it('resumes the active tab when it holds the video', () => {
    setTabs(['https://www.youtube.com/', `${VIDEO_URL}&list=PL1`], 1)
    resumeLastPlayingTab()
    expect(tabs$.tabs[0].url.get()).toBe('https://www.youtube.com/')
    expect(tabs$.tabs[1].url.get()).toBe(`${VIDEO_URL}&list=PL1&t=120s`)
    expect(tabs$.tabs[1].pageUrl.get()).toBe(`${VIDEO_URL}&list=PL1&t=120s`)
  })

  it('leaves duplicate tabs of the same video alone', () => {
    setTabs([VIDEO_URL, VIDEO_URL], 1)
    resumeLastPlayingTab()
    expect(tabs$.tabs[0].url.get()).toBe(VIDEO_URL)
    expect(tabs$.tabs[1].url.get()).toBe(`${VIDEO_URL}&t=120s`)
  })

  it('falls back to the first tab holding the video', () => {
    setTabs([VIDEO_URL, 'https://www.youtube.com/feed/subscriptions'], 1)
    resumeLastPlayingTab()
    expect(tabs$.tabs[0].url.get()).toBe(`${VIDEO_URL}&t=120s`)
    expect(tabs$.tabs[1].url.get()).toBe('https://www.youtube.com/feed/subscriptions')
  })

  it('brings the video back into the active tab when no tab holds it', () => {
    setTabs(['https://www.youtube.com/', 'https://music.youtube.com/'], 1)
    resumeLastPlayingTab()
    expect(tabs$.tabs[0].url.get()).toBe('https://www.youtube.com/')
    expect(tabs$.tabs[1].url.get()).toBe(`${VIDEO_URL}&t=120s`)
  })

  it('does nothing without a resumable video', () => {
    setLastPlaying(1)
    setTabs(['https://www.youtube.com/'], 0)
    resumeLastPlayingTab()
    expect(tabs$.tabs[0].url.get()).toBe('https://www.youtube.com/')
  })
})
