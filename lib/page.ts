import { ui$, updateUrl } from '@/states/ui'
import { onReceiveAuthUrl } from './supabase/auth'
import { settings$ } from '@/states/settings'
import { debounce } from 'es-toolkit'

export { getPageType } from './page-type'

export function fixPageTitle(title: string) {
  return title.replace(/ - YouTube( Music)*$/, '')
}

export function fixSharingUrl(v: string) {
  try {
    const url = new URL(v)
    url.searchParams.delete('pp')
    return url.href
  } catch {
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
  } catch {
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
      updateUrl(url.replace('noutube://', 'https://'))
    }
  } catch (error) {
    console.error(error)
  }
}

export const setPageUrl = debounce(async function (url: string) {
  if (!url) {
    return
  }
  ui$.pageUrl.set(url)
  const { host } = new URL(url)
  settings$.home.set(host === 'music.youtube.com' ? 'yt-music' : 'yt')
}, 300)
