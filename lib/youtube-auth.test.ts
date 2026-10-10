import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { getYouTubeAuthorization } from './youtube-auth'

describe('YouTube request authorization', () => {
  const origin = 'https://m.youtube.com'
  const now = 1_700_000_000_000
  const signature = (scheme: string, sid: string, requestOrigin = origin) =>
    `${scheme} 1700000000_${createHash('sha1').update(`1700000000 ${sid} ${requestOrigin}`).digest('hex')}`

  test('omits authorization when signed out', async () => {
    expect(await getYouTubeAuthorization(origin, '', now)).toBeUndefined()
    expect(await getYouTubeAuthorization(origin, 'PREF=example; VISITOR_INFO1_LIVE=visitor', now)).toBeUndefined()
  })

  test('signs each available SID using the request origin and timestamp', async () => {
    expect(await getYouTubeAuthorization(origin, 'SAPISID=test=sid; __Secure-1PAPISID=first; __Secure-3PAPISID=third', now)).toBe([
      signature('SAPISIDHASH', 'test=sid'), signature('SAPISID1PHASH', 'first'), signature('SAPISID3PHASH', 'third'),
    ].join(' '))
    expect(await getYouTubeAuthorization('https://www.youtube.com', 'SAPISID=sid', now)).toBe(
      signature('SAPISIDHASH', 'sid', 'https://www.youtube.com'),
    )
  })

  test('falls back to the third-party SID when SAPISID is absent', async () => {
    expect(await getYouTubeAuthorization(origin, '__Secure-3PAPISID=third', now)).toBe([
      signature('SAPISIDHASH', 'third'), signature('SAPISID3PHASH', 'third'),
    ].join(' '))
  })
})
