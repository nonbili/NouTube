import { openSharedUrl } from '@/lib/page'
import { isSupportedUrl } from '@/lib/supported-url'

export function handleDeeplink(link: string): void {
  const url = new URL(link)
  if (url.protocol != 'noutube:' && !isSupportedUrl(link)) {
    return
  }
  // console.log('on deeplink', link)
  openSharedUrl(link)
}

window.noutubeDeeplink = handleDeeplink
