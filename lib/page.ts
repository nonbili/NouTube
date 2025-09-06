import { ui$ } from '@/states/ui'
import { onReceiveAuthUrl } from './supabase/auth'
import { isWeb } from './utils'
import { settings$ } from '@/states/settings'
import { getWatchPageBookmark } from './webview'
import { history$ } from '@/states/history'
import { debounce } from 'es-toolkit'

const starrableTypes = ['channel', 'playlist', 'podcast', 'shorts', 'watch']

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
  if (host == 'music.youtube.com') {
    home = 'yt-music'
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    home = 'yt'
  }
  if (!home) {
    return
  }
  let type = pathname.slice(1).split('/')[0]
  let canStar = starrableTypes.includes(type)

  if (!canStar && (type.startsWith('@') || (type && pathname.split('/').length == 2))) {
    type = 'channel'
    canStar = true
  }
  return { home, type, canStar }
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

export const setPageUrl = debounce(async function (url: string) {
  if (!url) {
    return
  }
  ui$.pageUrl.set(url)
  const { host } = new URL(url)
  settings$.home.set(host == 'music.youtube.com' ? 'yt-music' : 'yt')

  const pageType = getPageType(url)
  if (settings$.keepHistory.get() && pageType?.type == 'watch') {
    setTimeout(async () => {
      const history = await getWatchPageBookmark(url)
      if (history.url == url) {
        history$.addBookmark(history)
      }
    }, 5000)
  }
}, 300)
