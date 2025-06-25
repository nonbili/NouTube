import { trimEnd } from 'es-toolkit'

const starrableTypes = ['channel', 'playlist', 'podcast', 'watch']

export function getPageType(url: string) {
  if (!url) {
    return
  }
  const { host, pathname } = new URL(url)
  let home
  if (host == 'music.youtube.com') {
    home = 'yt-music'
  } else if (['www.youtube.com', 'm.youtube.com'].includes(host)) {
    home = 'yt'
  }
  if (!home) {
    return
  }
  let type = pathname.slice(1).split('/')[0]
  if (type.startsWith('@')) {
    type = 'channel'
  }
  return { home, type, canStar: starrableTypes.includes(type) }
}

export function fixPageTitle(title: string) {
  return trimEnd(title, ['- YouTube', '- YouTube Music'])
}
