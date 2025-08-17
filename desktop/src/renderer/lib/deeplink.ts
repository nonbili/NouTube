import { openSharedUrl } from '@/lib/page'
import { supabase } from '@/lib/supabase/client.js'

export function handleDeeplink(link: string) {
  const url = new URL(link)
  if (url.protocol != 'noutube:') {
    return
  }
  // console.log('on deeplink', link)
  openSharedUrl(link)
}

window.noutubeDeeplink = handleDeeplink
