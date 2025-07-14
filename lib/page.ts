const starrableTypes = ['channel', 'playlist', 'podcast', 'shorts', 'watch']

export function getPageType(url: string) {
  if (!url) {
    return
  }
  const { host, pathname } = new URL(url)
  let home
  if (host == 'music.youtube.com') {
    home = 'yt-music'
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
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
  return title.replace(/ - YouTube( Music)*$/, '')
}

export function fixSharingUrl(v: string) {
  try {
    const url = new URL(v)
    url.searchParams.delete('pp')
    return url.href
  } catch (e) {
    return ''
  }
}

export function getVideoThumbnail(id: string) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
