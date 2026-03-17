import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'

export type FeedManageSort = 'lastVideo' | 'frequency'
export type FeedManageOrder = 'desc' | 'asc'
export const ALL_FEED_FILTER_KEY = 'all'
const FOLDER_FEED_FILTER_PREFIX = 'folder:'
const CHANNEL_FEED_FILTER_PREFIX = 'channel:'

export interface FeedManagementItem {
  channel: Bookmark
  folder?: Folder
  lastVideoAt?: Date
  videosPerDay30d: number
}

interface BuildFeedManagementItemsParams {
  channels: Bookmark[]
  feedBookmarks: Bookmark[]
  folders: Folder[]
  now?: Date
}

interface FilterFeedManagementItemsParams {
  items: FeedManagementItem[]
  search: string
  filterKey: string
  sort: FeedManageSort
  order: FeedManageOrder
}

export function makeFolderFeedFilterKey(folderId: string) {
  return `${FOLDER_FEED_FILTER_PREFIX}${folderId}`
}

export function makeChannelFeedFilterKey(channelBookmarkId: string) {
  return `${CHANNEL_FEED_FILTER_PREFIX}${channelBookmarkId}`
}

export function parseFeedFilterKey(filterKey: string) {
  if (!filterKey || filterKey === ALL_FEED_FILTER_KEY) {
    return { kind: 'all' as const }
  }

  if (filterKey.startsWith(CHANNEL_FEED_FILTER_PREFIX)) {
    return {
      kind: 'channel' as const,
      id: filterKey.slice(CHANNEL_FEED_FILTER_PREFIX.length),
    }
  }

  if (filterKey.startsWith(FOLDER_FEED_FILTER_PREFIX)) {
    return {
      kind: 'folder' as const,
      id: filterKey.slice(FOLDER_FEED_FILTER_PREFIX.length),
    }
  }

  return { kind: 'all' as const }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function buildFeedManagementItems({
  channels,
  feedBookmarks,
  folders,
  now = new Date(),
}: BuildFeedManagementItemsParams): FeedManagementItem[] {
  const channelFolders = new Map(
    folders.filter((x) => !x.json.deleted && x.json.tab === 'channel').map((folder) => [folder.id, folder] as const),
  )
  const feedBookmarksByChannelId = new Map<string, Bookmark[]>()

  for (const bookmark of feedBookmarks) {
    if (bookmark.json.deleted || !bookmark.json.id) {
      continue
    }
    const items = feedBookmarksByChannelId.get(bookmark.json.id) || []
    items.push(bookmark)
    feedBookmarksByChannelId.set(bookmark.json.id, items)
  }

  const cutoff = now.valueOf() - THIRTY_DAYS_MS

  return channels.map((channel) => {
    const channelId = channel.json.id || ''
    const items = channelId ? (feedBookmarksByChannelId.get(channelId) ?? []) : []
    let lastVideoAt: Date | undefined
    let oldestVideoAtInWindow: Date | undefined
    let videosLast30d = 0

    for (const item of items) {
      if (!lastVideoAt || item.created_at.valueOf() > lastVideoAt.valueOf()) {
        lastVideoAt = item.created_at
      }
      if (item.created_at.valueOf() >= cutoff) {
        videosLast30d += 1
        if (!oldestVideoAtInWindow || item.created_at.valueOf() < oldestVideoAtInWindow.valueOf()) {
          oldestVideoAtInWindow = item.created_at
        }
      }
    }

    const daysCovered = oldestVideoAtInWindow
      ? Math.max(1, Math.floor((now.valueOf() - oldestVideoAtInWindow.valueOf()) / DAY_MS))
      : 0

    return {
      channel,
      folder: channel.json.folder ? channelFolders.get(channel.json.folder) : undefined,
      lastVideoAt,
      videosPerDay30d: daysCovered ? Number((videosLast30d / daysCovered).toFixed(1)) : 0,
    }
  })
}

export function filterFeedManagementItems({
  items,
  search,
  filterKey,
  sort,
  order,
}: FilterFeedManagementItemsParams): FeedManagementItem[] {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filter = parseFeedFilterKey(filterKey)

  const filtered = items.filter((item) => {
    if (filter.kind === 'folder') {
      const itemFolderId = item.channel.json.folder || ''
      if (itemFolderId !== filter.id) {
        return false
      }
    }

    if (filter.kind === 'channel' && item.channel.id !== filter.id) {
        return false
    }

    if (!normalizedSearch) {
      return true
    }

    const title = item.channel.title.toLocaleLowerCase()
    const folderName = item.folder?.name.toLocaleLowerCase() || ''
    return title.includes(normalizedSearch) || folderName.includes(normalizedSearch)
  })

  return filtered.sort((a, b) => compareFeedManagementItems(a, b, sort, order))
}

function compareFeedManagementItems(
  a: FeedManagementItem,
  b: FeedManagementItem,
  sort: FeedManageSort,
  order: FeedManageOrder,
) {
  const direction = order === 'desc' ? -1 : 1

  if (sort === 'frequency' && b.videosPerDay30d !== a.videosPerDay30d) {
    return (a.videosPerDay30d - b.videosPerDay30d) * direction
  }

  const lastVideoDelta = ((a.lastVideoAt?.valueOf() || 0) - (b.lastVideoAt?.valueOf() || 0)) * direction
  if (lastVideoDelta !== 0) {
    return lastVideoDelta
  }

  return a.channel.title.localeCompare(b.channel.title)
}
