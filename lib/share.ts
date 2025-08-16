import { Share } from 'react-native'
import { fixSharingUrl } from '@/lib/page'
import { isWeb } from './utils'
import { showToast } from './toast'

export function share(url: string) {
  url = fixSharingUrl(url)
  if (isWeb) {
    navigator.clipboard.writeText(url)
    showToast('Copied to clipboard')
  } else {
    Share.share({ message: url })
  }
}
