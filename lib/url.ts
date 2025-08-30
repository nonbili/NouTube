import { isWeb } from './utils'

export function normalizeUrl(url: string) {
  if (!url) {
    return url
  }
  const newURL = new URL(url)
  if (!['m.youtube.com', 'music.youtube.com'].includes(newURL.host)) {
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
  if ('m.youtube.com' == newURL.host) {
    newURL.host = 'www.youtube.com'
  }
  return newURL.href
}
