import { isWeb } from './utils'

export { removeTrackingParams } from './tracking-url'

export function normalizeUrl(url: string, isYTMusic = false) {
  if (!url) {
    return url
  }
  const newURL = new URL(url)
  if (isYTMusic || newURL.host === 'music.youtube.com') {
    newURL.host = 'music.youtube.com'
  } else if (!['m.youtube.com', 'music.youtube.com'].includes(newURL.host)) {
    newURL.host = 'm.youtube.com'
  }
  newURL.searchParams.delete('app')
  return newURL.href
}

export function unnormalizeUrl(url: string) {
  if (!isWeb || !url) {
    return url
  }
  const newURL = new URL(url)
  if (newURL.host === 'music.youtube.com') {
    return newURL.href
  }
  if ('m.youtube.com' == newURL.host) {
    newURL.host = 'www.youtube.com'
  }
  return newURL.href
}
