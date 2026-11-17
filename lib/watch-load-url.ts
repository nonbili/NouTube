import { settings$ } from '@/states/settings'
import { noAdWatchUrl } from './no-ad-request'
import { isAndroid, isIos } from './utils'

export function watchLoadUrl(url: string) {
  if (!isAndroid && !isIos) return url
  try {
    return noAdWatchUrl(url, settings$.blockAds.peek() !== false) || url
  } catch {
    return url
  }
}
