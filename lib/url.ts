import { isWeb } from './utils'

export { removeTrackingParams } from './tracking-url'

export function normalizeUrl(url: string) {
  if (!url) {
    return url
  }
  const newURL = new URL(url)
  if (newURL.host === 'youtu.be') {
    // A share link: the host swap alone would leave the id in the path.
    const id = newURL.pathname.split('/').filter(Boolean)[0]
    if (id) {
      const watch = new URL('https://m.youtube.com/watch')
      watch.searchParams.set('v', id)
      return watch.href
    }
  }
  if (!['m.youtube.com', 'music.youtube.com'].includes(newURL.host)) {
    newURL.host = 'm.youtube.com'
  }
  newURL.searchParams.delete('app')
  // Tracking params are noise on a stored url and differ every visit.
  newURL.searchParams.delete('pp')
  newURL.searchParams.delete('si')
  return newURL.href
}

export function unnormalizeUrl(url: string) {
  if (!isWeb || !url) {
    return url
  }
  const newURL = new URL(url)
  if ('m.youtube.com' == newURL.host) {
    newURL.host = 'www.youtube.com'
  }
  return newURL.href
}

// A channel is the same channel whichever tab is open.
const channelTabs = new Set([
  'videos',
  'shorts',
  'streams',
  'live',
  'playlists',
  'community',
  'posts',
  'podcasts',
  'releases',
  'courses',
  'store',
  'channels',
  'featured',
  'about',
])

/**
 * The identity of a bookmarked page, for comparing urls only -- never for
 * storing or loading one. The same video reaches us under a pile of spellings:
 * www/m hosts, youtu.be links, /shorts paths, a resume time, tracking params
 * and the playlist it happened to be played from. Comparing raw urls left the
 * star blank on pages that are already in the library.
 */
export function getBookmarkKey(url: string) {
  if (!url) {
    return ''
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  const host = parsed.host === 'music.youtube.com' ? 'music.youtube.com' : 'm.youtube.com'
  const segments = parsed.pathname.split('/').filter(Boolean)
  let videoId = parsed.searchParams.get('v') || ''
  if (parsed.host === 'youtu.be') {
    videoId = segments[0] || ''
  } else if (segments[0] === 'shorts') {
    videoId = segments[1] || ''
  }
  if (videoId) {
    return `https://${host}/watch?v=${videoId}`
  }
  // A playlist, a podcast or a YouTube Music radio: the list is the page.
  const listId = parsed.searchParams.get('list') || ''
  if (listId) {
    return `https://${host}/${segments[0] || 'playlist'}?list=${listId}`
  }
  const tail = segments.length > 1 && channelTabs.has(segments[segments.length - 1]) ? segments.slice(0, -1) : segments
  return `https://${host}/${tail.join('/')}`
}
