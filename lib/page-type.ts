const starrableTypes = ['channel', 'playlist', 'podcast', 'shorts', 'watch']
const nonChannelSingleSegmentTypes = ['results']

export function getPageType(url: string) {
  if (!url) {
    return
  }
  let host, pathname
  try {
    ;({ host, pathname } = new URL(url))
  } catch (e) {
    console.error(e)
    return
  }
  let home
  if (host === 'music.youtube.com') {
    home = 'yt-music'
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    home = 'yt'
  }
  if (!home) {
    return
  }
  let type = pathname.slice(1).split('/')[0]
  let canStar = starrableTypes.includes(type)

  if (
    !canStar &&
    (type.startsWith('@') ||
      (!!type && pathname.split('/').length === 2 && !nonChannelSingleSegmentTypes.includes(type)))
  ) {
    type = 'channel'
    canStar = true
  }
  return { home, type, canStar }
}
