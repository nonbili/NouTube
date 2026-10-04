import type { Bookmark } from '@/states/bookmarks'
import { getPageType } from './page-type'

export interface FeedNotificationUpdate {
  channel: string
  count: number
}

// A successful first fetch establishes the baseline. Cache eviction, edited
// titles and videos resurfacing in RSS must not turn old uploads into alerts.
export function getFeedNotificationVideos(
  videos: Bookmark[],
  latestPublishedAt: Date | undefined,
  knownUrls: Set<string>,
  hideShorts = false,
) {
  if (latestPublishedAt === undefined) return []
  const cutoff = new Date(latestPublishedAt).valueOf()
  const seen = new Set(knownUrls)
  return videos.filter((video) => {
    if (hideShorts && getPageType(video.url)?.type === 'shorts') return false
    if (seen.has(video.url)) return false
    seen.add(video.url)
    return new Date(video.created_at).valueOf() > cutoff
  })
}

export function getLatestFeedPublishedAt(videos: Bookmark[], previous?: Date) {
  const timestamps = videos.map((video) => new Date(video.created_at).valueOf()).filter(Number.isFinite)
  return new Date(Math.max(new Date(previous ?? 0).valueOf(), ...timestamps))
}
