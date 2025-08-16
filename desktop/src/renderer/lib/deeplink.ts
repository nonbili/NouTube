import { openSharedUrl } from '@/lib/page'
import { supabase } from '@/lib/supabase/client.js'

export function handleDeeplink(link: string) {
  const url = new URL(link)
  if (url.protocol != 'noutube:') {
    return
  }
  if (url.pathname == 'auth') {
    const token = url.searchParams.get('t')
    if (token) {
      // https://github.com/orgs/supabase/discussions/27181#discussioncomment-10986267
      supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      })
      return
    }
  } else {
    openSharedUrl(link)
  }
  console.log('on deeplink', link)
}

window.noutubeDeeplink = handleDeeplink
