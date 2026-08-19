import { beforeEach, describe, expect, it } from 'bun:test'
import { history$ } from '@/states/history'
import { getLastPlaying, getVideoIdFromUrl, withResumeTime } from './last-playing'

const setLastPlaying = (entry: { current: number; duration: number; url?: string }) => {
  history$.bookmarks.set([
    {
      id: 'last',
      videoId: 'abc123',
      url: entry.url ?? 'https://www.youtube.com/watch?v=abc123',
      title: 'last',
      duration: entry.duration,
      current: entry.current,
      updatedAt: Date.now(),
    },
  ])
}

describe('getLastPlaying', () => {
  beforeEach(() => {
    history$.bookmarks.set([])
  })

  it('returns nothing without history', () => {
    expect(getLastPlaying()).toBeUndefined()
  })

  it('bakes the position into the url', () => {
    setLastPlaying({ current: 123.7, duration: 600 })
    expect(getLastPlaying()?.url).toBe('https://www.youtube.com/watch?v=abc123&t=123s')
  })

  it('replaces the stale position saved by the player', () => {
    setLastPlaying({ current: 200, duration: 600, url: 'https://www.youtube.com/watch?v=abc123&t=10s' })
    expect(getLastPlaying()?.url).toBe('https://www.youtube.com/watch?v=abc123&t=200s')
  })

  it('skips a video barely started', () => {
    setLastPlaying({ current: 2, duration: 600 })
    expect(getLastPlaying()).toBeUndefined()
  })

  it('skips a video watched to the end', () => {
    setLastPlaying({ current: 595, duration: 600 })
    expect(getLastPlaying()).toBeUndefined()
  })
})

describe('withResumeTime', () => {
  it('keeps other params', () => {
    expect(withResumeTime('https://www.youtube.com/watch?v=abc123&list=PL1', 30)).toBe(
      'https://www.youtube.com/watch?v=abc123&list=PL1&t=30s',
    )
  })

  it('returns invalid urls untouched', () => {
    expect(withResumeTime('not a url', 30)).toBe('not a url')
  })
})

describe('getVideoIdFromUrl', () => {
  it('reads the video id', () => {
    expect(getVideoIdFromUrl('https://m.youtube.com/watch?v=abc123&t=5s')).toBe('abc123')
  })

  it('returns empty for non video urls', () => {
    expect(getVideoIdFromUrl('https://www.youtube.com/')).toBe('')
    expect(getVideoIdFromUrl('nope')).toBe('')
  })
})
