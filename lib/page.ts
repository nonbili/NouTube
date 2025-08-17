import { ui$ } from '@/states/ui'
import { onReceiveAuthUrl } from './supabase/auth'

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

/* https://www.youtube.com/watch?v=<id> */
export function getVideoId(url: string) {
  try {
    return new URL(url).searchParams.get('v')
  } catch (e) {
    return ''
  }
}

export function getThumbnail(url: string) {
  const id = getVideoId(url)
  return id ? getVideoThumbnail(id) : undefined
}

export function openSharedUrl(url: string) {
  if (url.startsWith('noutube:auth')) {
    onReceiveAuthUrl(url)
    return
  }
  try {
    const { host } = new URL(fixSharingUrl(url))
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
      ui$.url.set(url.replace('noutube://', 'https://'))
    }
  } catch (e) {
    console.error(e)
  }
}

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
