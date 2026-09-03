import { getPageType } from '@/lib/page-type'

const SAVEABLE_PAGE_TYPES = new Set(['channel', 'playlist', 'shorts', 'watch'])

export const SAVE_BOOKMARK_LINK_MATCHES = [
  'https://www.youtube.com/watch*',
  'https://m.youtube.com/watch*',
  'https://music.youtube.com/watch*',
  'https://www.youtube.com/shorts/*',
  'https://m.youtube.com/shorts/*',
  'https://www.youtube.com/@*',
  'https://m.youtube.com/@*',
  'https://www.youtube.com/channel/*',
  'https://m.youtube.com/channel/*',
  'https://music.youtube.com/channel/*',
  'https://www.youtube.com/c/*',
  'https://m.youtube.com/c/*',
  'https://www.youtube.com/user/*',
  'https://m.youtube.com/user/*',
  'https://www.youtube.com/playlist*',
  'https://m.youtube.com/playlist*',
  'https://music.youtube.com/playlist*',
]

export function isSaveableBookmarkUrl(url: string) {
  const pageType = getPageType(url)
  return Boolean(pageType?.home && SAVEABLE_PAGE_TYPES.has(pageType.type))
}
