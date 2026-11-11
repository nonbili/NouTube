// Thumbnail links often contain only a duration or LIVE badge. Resolve the
// heading on the same video card before considering the link's own text.
const VIDEO_CARD = [
  'ytm-media-item', 'ytm-compact-video-renderer', 'ytm-video-card-renderer',
  'ytm-playlist-video-renderer', 'ytm-rich-item-renderer',
  'ytd-video-renderer', 'ytd-grid-video-renderer', 'ytd-compact-video-renderer',
  'ytd-playlist-video-renderer', 'yt-lockup-view-model',
  'ytmusic-responsive-list-item-renderer', 'ytmusic-two-row-item-renderer',
].join(',')

function videoId(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1)
    if (url.hostname !== 'youtube.com' && !url.hostname.endsWith('.youtube.com')) return
    return url.pathname === '/watch'
      ? url.searchParams.get('v') || undefined
      : url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1]
  } catch {
    return
  }
}

export function getVideoLinkTitle(href: string, root: Document = document): string {
  const base = root.location?.href || 'https://www.youtube.com/'
  const id = videoId(href, base)
  if (!id) return ''

  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((link) => videoId(link.getAttribute('href') || '', base) === id)

  for (const link of links) {
    const card = link.closest(VIDEO_CARD)
    const title = card?.querySelector(
      'h3, h4, #video-title, .yt-lockup-metadata-view-model__title, .title',
    )?.textContent?.trim()
    if (title) return title
  }

  for (const link of links) {
    const title = link.getAttribute('title')?.trim() || link.textContent?.trim()
    if (title && !/^(?:\d+:)*\d+$|^live$/i.test(title)) return title
  }
  return ''
}
