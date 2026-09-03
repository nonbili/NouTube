import { browser } from 'wxt/browser'
import { auth$ } from '@/states/auth'
import { supabase } from '@/lib/supabase/client'

/*
 * The app signs in through https://noutube.inks.page/auth/app, which hands the
 * single-use token back over the `noutube://` deep link — a scheme no browser
 * will route to an extension. The extension page of the same site mints the same
 * token against the redirect URL the browser itself owns, which is the only
 * callback `launchWebAuthFlow` will accept.
 */
const AUTH_URL = 'https://noutube.inks.page/auth/extension'
const ME_URL = 'https://a.inks.page/api/noutube.me'

export async function fetchPlan(accessToken: string) {
  try {
    const res = await fetch(ME_URL, { headers: { authorization: accessToken } })
    const data = await res.json()
    return (data?.result?.data?.plan as string) || 'free'
  } catch {
    return 'free'
  }
}

export async function applySession(session: { user: { id: string; email?: string }; access_token: string } | null) {
  if (!session) {
    auth$.assign({ loaded: true, userId: undefined, user: undefined, accessToken: '', plan: 'free' })
    return
  }

  auth$.assign({
    loaded: true,
    userId: session.user.id,
    accessToken: session.access_token,
    plan: auth$.plan.get() || 'free',
  })
  auth$.plan.set(await fetchPlan(session.access_token))
}

export async function restoreSession() {
  const { data } = await supabase.auth.getSession()
  await applySession(data.session as never)
  return data.session
}

export function watchSession() {
  supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session as never)
  })
}

export async function signIn() {
  const state = crypto.randomUUID()
  const redirect = browser.identity.getRedirectURL('auth')
  const url = new URL(AUTH_URL)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('state', state)

  const callback = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive: true })
  if (!callback) {
    throw new Error('Sign-in was cancelled')
  }

  const result = new URL(callback)
  if (result.searchParams.get('state') !== state) {
    throw new Error('Invalid sign-in state')
  }

  const failure = result.searchParams.get('error_description') || result.searchParams.get('error')
  if (failure) {
    throw new Error(failure)
  }

  const token = result.searchParams.get('t')
  if (!token) {
    throw new Error('Sign-in token missing')
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' })
  if (error) {
    throw error
  }

  return restoreSession()
}

export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' })
  await applySession(null)
}
