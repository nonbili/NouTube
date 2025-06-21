export function getPageType(url: string) {
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
  return { home, type }
}

export function fixPageTitle(title: string) {
  const suffix = ' - YouTube'
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}
