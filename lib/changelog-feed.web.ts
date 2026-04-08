import { mainClient } from '@/lib/main-client'

const DESKTOP_RELEASES_FEED_URL = 'https://github.com/nonbili/NouTube-Desktop/releases.atom'

export async function fetchReleaseFeed() {
  const res = await mainClient.fetchFeed(DESKTOP_RELEASES_FEED_URL)

  if (!res || res.status < 200 || res.status >= 300 || typeof res.body !== 'string') {
    throw new Error(`Failed to fetch changelog: ${res?.status || 'unknown'}`)
  }

  return res.body
}
