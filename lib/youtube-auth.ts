// Match YouTube's cookie-derived request signatures. Compute them afresh for
// each request; neither cookie values nor signatures leave the page's origin.
export async function getYouTubeAuthorization(origin: string, cookie: string, now = Date.now()) {
  const cookies = new Map(cookie.split(';').map((part) => {
    const separator = part.indexOf('=')
    return [part.slice(0, separator).trim(), part.slice(separator + 1)]
  }))
  const thirdParty = cookies.get('__Secure-3PAPISID')
  const sources = [
    ['SAPISIDHASH', cookies.get('SAPISID') || thirdParty],
    ['SAPISID1PHASH', cookies.get('__Secure-1PAPISID')],
    ['SAPISID3PHASH', thirdParty],
  ]
  const timestamp = Math.floor(now / 1000)
  const signatures = await Promise.all(sources.filter(([, sid]) => sid).map(async ([scheme, sid]) => {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${timestamp} ${sid} ${origin}`))
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${scheme} ${timestamp}_${hash}`
  }))
  return signatures.length ? signatures.join(' ') : undefined
}
