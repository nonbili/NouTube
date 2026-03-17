import { describe, expect, it } from 'bun:test'
import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'
import {
  buildFeedManagementItems,
  filterFeedManagementItems,
  makeChannelFeedFilterKey,
  makeFolderFeedFilterKey,
} from './feed-management'

function makeChannel(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: overrides.id || 'channel-bookmark',
    url: overrides.url || 'https://www.youtube.com/@demo',
    title: overrides.title || 'Demo Channel',
    created_at: overrides.created_at || new Date('2026-03-01T00:00:00.000Z'),
    updated_at: overrides.updated_at || new Date('2026-03-01T00:00:00.000Z'),
    json: {
      id: 'channel-1',
      ...overrides.json,
    },
  }
}

function makeFeedVideo(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: overrides.id || 'feed-video',
    url: overrides.url || 'https://www.youtube.com/watch?v=demo',
    title: overrides.title || 'Video',
    created_at: overrides.created_at || new Date('2026-03-15T00:00:00.000Z'),
    updated_at: overrides.updated_at || new Date('2026-03-15T00:00:00.000Z'),
    json: {
      id: 'channel-1',
      ...overrides.json,
    },
  }
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: overrides.id || 'folder-1',
    name: overrides.name || 'News',
    created_at: overrides.created_at || new Date('2026-03-01T00:00:00.000Z'),
    updated_at: overrides.updated_at || new Date('2026-03-01T00:00:00.000Z'),
    json: {
      tab: 'channel',
      ...overrides.json,
    },
  }
}

describe('feed management selectors', () => {
  it('builds last video and frequency from the active local window', () => {
    const items = buildFeedManagementItems({
      channels: [makeChannel({ json: { id: 'channel-1', folder: 'folder-1' } })],
      feedBookmarks: [
        makeFeedVideo({ id: 'recent-1', created_at: new Date('2026-03-15T00:00:00.000Z') }),
        makeFeedVideo({ id: 'recent-2', created_at: new Date('2026-03-14T00:00:00.000Z') }),
        makeFeedVideo({ id: 'old', created_at: new Date('2026-01-01T00:00:00.000Z') }),
      ],
      folders: [makeFolder()],
      now: new Date('2026-03-17T00:00:00.000Z'),
    })

    expect(items).toHaveLength(1)
    expect(items[0].folder?.name).toBe('News')
    expect(items[0].lastVideoAt?.toISOString()).toBe('2026-03-15T00:00:00.000Z')
    expect(items[0].videosPerDay30d).toBe(0.7)
  })

  it('uses 1 day as the minimum frequency divisor', () => {
    const items = buildFeedManagementItems({
      channels: [makeChannel({ json: { id: 'channel-1' } })],
      feedBookmarks: [makeFeedVideo({ id: 'recent-1', created_at: new Date('2026-03-16T12:00:00.000Z') })],
      folders: [],
      now: new Date('2026-03-17T00:00:00.000Z'),
    })

    expect(items[0].videosPerDay30d).toBe(1)
  })

  it('filters by folder and search term', () => {
    const items = buildFeedManagementItems({
      channels: [
        makeChannel({ id: 'channel-a', title: 'Alpha', json: { id: 'channel-a', folder: 'folder-1' } }),
        makeChannel({ id: 'channel-b', title: 'Beta', json: { id: 'channel-b' } }),
      ],
      feedBookmarks: [],
      folders: [makeFolder()],
      now: new Date('2026-03-17T00:00:00.000Z'),
    })

    const filtered = filterFeedManagementItems({
      items,
      search: 'news',
      filterKey: makeFolderFeedFilterKey('folder-1'),
      sort: 'lastVideo',
      order: 'desc',
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].channel.title).toBe('Alpha')
  })

  it('sorts by frequency with last video and title tie-breakers', () => {
    const items = [
      {
        channel: makeChannel({ id: 'a', title: 'Alpha' }),
        videosPerDay30d: 0.2,
        lastVideoAt: new Date('2026-03-12T00:00:00.000Z'),
      },
      {
        channel: makeChannel({ id: 'b', title: 'Beta' }),
        videosPerDay30d: 0.5,
        lastVideoAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        channel: makeChannel({ id: 'c', title: 'Gamma' }),
        videosPerDay30d: 0.5,
        lastVideoAt: new Date('2026-03-16T00:00:00.000Z'),
      },
    ]

    const sorted = filterFeedManagementItems({
      items,
      search: '',
      filterKey: 'all',
      sort: 'frequency',
      order: 'desc',
    })

    expect(sorted.map((item) => item.channel.title)).toEqual(['Gamma', 'Beta', 'Alpha'])
  })

  it('supports reverse ordering', () => {
    const items = [
      {
        channel: makeChannel({ id: 'a', title: 'Alpha' }),
        videosPerDay30d: 0.2,
        lastVideoAt: new Date('2026-03-12T00:00:00.000Z'),
      },
      {
        channel: makeChannel({ id: 'b', title: 'Beta' }),
        videosPerDay30d: 0.5,
        lastVideoAt: new Date('2026-03-10T00:00:00.000Z'),
      },
    ]

    const sorted = filterFeedManagementItems({
      items,
      search: '',
      filterKey: 'all',
      sort: 'frequency',
      order: 'asc',
    })

    expect(sorted.map((item) => item.channel.title)).toEqual(['Alpha', 'Beta'])
  })

  it('filters by channel bookmark id', () => {
    const items = buildFeedManagementItems({
      channels: [
        makeChannel({ id: 'channel-a', title: 'Alpha', json: { id: 'channel-a', folder: 'folder-1' } }),
        makeChannel({ id: 'channel-b', title: 'Beta', json: { id: 'channel-b' } }),
      ],
      feedBookmarks: [],
      folders: [makeFolder()],
      now: new Date('2026-03-17T00:00:00.000Z'),
    })

    const filtered = filterFeedManagementItems({
      items,
      search: '',
      filterKey: makeChannelFeedFilterKey('channel-b'),
      sort: 'lastVideo',
      order: 'desc',
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].channel.title).toBe('Beta')
  })
})
