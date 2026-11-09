import { openSharedUrl } from '@/lib/page'
import { isSupportedUrl } from '@/lib/supported-url'
import '../../types'

export function handleDeeplink(link: string, newTab = false): void {
  const url = new URL(link)
  if (url.protocol != 'noutube:' && !isSupportedUrl(link)) {
    return
  }
  // console.log('on deeplink', link)
  openSharedUrl(link, { newTab })
}

window.noutubeDeeplink = handleDeeplink
