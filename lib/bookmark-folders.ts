import { getPageType } from './page'

export function getBookmarkFolderTab(url: string) {
  const pageType = getPageType(url)
  if (pageType?.home === 'yt-music') {
    if (pageType.type === 'channel') return 'm-channel'
    if (pageType.type === 'playlist') return 'm-playlist'
    return 'm-watch'
  }
  if (pageType?.type === 'channel') return 'channel'
  if (pageType?.type === 'playlist') return 'playlist'
  return 'watch'
}
