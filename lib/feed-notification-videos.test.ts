import { describe, expect, it } from 'bun:test'
import type { Bookmark } from '@/states/bookmarks'
import { getFeedNotificationVideos, getLatestFeedPublishedAt } from './feed-notification-videos'

function video(url: string, published: string): Bookmark {
  return {
    id: url, url: url.startsWith('https:') ? url : `https://m.youtube.com/watch?v=${url}`, title: url, json: {},
    created_at: new Date(published), updated_at: new Date(published),
  }
}
const old = video('old', '2026-10-01T00:00:00Z')
const fresh = video('fresh', '2026-10-02T00:00:00Z')

describe('feed notification detection', () => {
  it('establishes a baseline without notifying about a new channel’s existing videos', () => {
    expect(getFeedNotificationVideos([old, fresh], undefined, new Set())).toEqual([])
    expect(getLatestFeedPublishedAt([old, fresh])).toEqual(fresh.created_at)
  })

  it('reports new uploads once, including after persistence restores dates as strings', () => {
    const cutoff = old.created_at.toISOString() as unknown as Date
    expect(getFeedNotificationVideos([old, fresh, fresh], cutoff, new Set())).toEqual([fresh])
    expect(getFeedNotificationVideos([old, fresh], cutoff, new Set([fresh.url]))).toEqual([])
    expect(getFeedNotificationVideos([old, fresh], getLatestFeedPublishedAt([old, fresh]), new Set())).toEqual([])
  })

  it('does not alert for older videos evicted from cache or returned out of order', () => {
    expect(getFeedNotificationVideos([old], fresh.created_at, new Set())).toEqual([])
    expect(getLatestFeedPublishedAt([old], fresh.created_at)).toEqual(fresh.created_at)
  })

  it('excludes hidden Shorts while still advancing their publication baseline', () => {
    const short = video('https://m.youtube.com/shorts/short-id', '2026-10-03T00:00:00Z')
    expect(getFeedNotificationVideos([short, fresh], old.created_at, new Set(), true)).toEqual([fresh])
    expect(getFeedNotificationVideos([short, fresh], old.created_at, new Set(), false)).toEqual([short, fresh])
    const latest = getLatestFeedPublishedAt([short, fresh], old.created_at)
    expect(latest).toEqual(short.created_at)
    expect(getFeedNotificationVideos([short, fresh], latest, new Set(), false)).toEqual([])
  })

  it('ignores invalid publication dates and retains the baseline for an empty feed', () => {
    const invalid = video('invalid', 'invalid')
    expect(getFeedNotificationVideos([invalid, fresh], old.created_at, new Set())).toEqual([fresh])
    expect(getLatestFeedPublishedAt([invalid, old])).toEqual(old.created_at)
    expect(getLatestFeedPublishedAt([], old.created_at)).toEqual(old.created_at)
  })
})
