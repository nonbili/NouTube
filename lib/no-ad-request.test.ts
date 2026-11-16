import { expect, it } from 'bun:test'
import { gzipSync, gunzipSync } from 'node:zlib'
import { noAdRequestBody, noAdFetchArgs, installNoAdWatchLinks } from '../content/no-ad-request'
import { NO_AD_PLAYER_PARAMS, noAdWatchUrl } from './no-ad-request'
import { watchLoadUrl } from './watch-load-url'
import { settings$ } from '@/states/settings'

it('cleans an opted-out document reload without touching unrelated player params', () => {
  const keys = ['window', 'location', 'document'] as const
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  const replacements: string[] = []
  try {
    const location = { href: 'https://m.youtube.com/watch?v=abc&pp=oAEBogYBLg', replace: (url: string) => replacements.push(url) }
    Object.assign(globalThis, {
      window: { NouTube: { getSettings: () => ({ blockAds: false }) } },
      location,
      document: { addEventListener: () => {} },
    })
    installNoAdWatchLinks()
    expect(replacements).toEqual(['https://m.youtube.com/watch?v=abc'])
    location.href = 'https://m.youtube.com/watch?v=abc&pp=unrelated'
    installNoAdWatchLinks()
    expect(replacements).toHaveLength(1)
  } finally {
    keys.forEach((key, index) => {
      if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!)
      else delete (globalThis as any)[key]
    })
  }
})

it('leaves native watch loads untouched when ad blocking is off', () => {
  const original = settings$.blockAds.peek()
  try {
    settings$.blockAds.set(false)
    expect(watchLoadUrl('https://m.youtube.com/watch?v=abc')).toBe('https://m.youtube.com/watch?v=abc')
    expect(watchLoadUrl('https://m.youtube.com/watch?v=abc&pp=oAEBogYBLg')).toBe('https://m.youtube.com/watch?v=abc')
    expect(watchLoadUrl('https://m.youtube.com/watch?v=abc&pp=unrelated')).toBe('https://m.youtube.com/watch?v=abc&pp=unrelated')
    settings$.blockAds.set(true)
    expect(watchLoadUrl('https://m.youtube.com/watch?v=abc')).toBe('https://m.youtube.com/watch?v=abc&pp=oAEBogYBLg')
  } finally {
    settings$.blockAds.set(original)
  }
})

it('only adds pp to YouTube watch pages, preserving other parameters', () => {
  expect(noAdWatchUrl('https://m.youtube.com/watch?v=abc&pp=old&t=5')).toBe(
    'https://m.youtube.com/watch?v=abc&pp=oAEBogYBLg&t=5',
  )
  expect(noAdWatchUrl('https://example.com/watch?v=abc')).toBeNull()
  expect(noAdWatchUrl('https://m.youtube.com/shorts/abc')).toBeNull()
})

it('rewrites plain and gzipped player bodies, preserving encoding', () => {
  expect(JSON.parse(noAdRequestBody('player', '{"videoId":"abc","params":"old"}') as string)).toEqual({
    videoId: 'abc', params: NO_AD_PLAYER_PARAMS,
  })
  const input = gzipSync(JSON.stringify({ playerRequest: { videoId: 'abc' }, nextRequest: { params: 'keep' } }))
  const result = noAdRequestBody('get_watch', input) as Uint8Array
  expect(JSON.parse(gunzipSync(result).toString())).toEqual({
    playerRequest: { videoId: 'abc', params: NO_AD_PLAYER_PARAMS }, nextRequest: { params: 'keep' },
  })
  expect(noAdRequestBody('player', 'invalid')).toBeNull()
  expect(noAdRequestBody('get_watch', '{}')).toBeNull()
  expect(noAdRequestBody('player', '[]')).toBeNull()
})

it('preserves fetch options and Request overrides, leaving the original body readable', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'location')
  Object.assign(globalThis, { location: { href: 'https://m.youtube.com/' } })
  try {
    const request = new Request('https://m.youtube.com/youtubei/v1/player', {
      method: 'POST', body: '{"videoId":"original"}', credentials: 'include', headers: { 'x-test': 'keep' },
    })
    const [rewritten] = await noAdFetchArgs([request, { body: '{"videoId":"override"}' }])
    const result = rewritten as Request
    expect(await result.json()).toEqual({ videoId: 'override', params: NO_AD_PLAYER_PARAMS })
    expect(result.credentials).toBe('include')
    expect(result.headers.get('x-test')).toBe('keep')
    expect(await request.json()).toEqual({ videoId: 'original' })
    const args: Parameters<typeof fetch> = ['https://example.com/youtubei/v1/player', { method: 'POST', body: '{}' }]
    expect(await noAdFetchArgs(args)).toBe(args)
    const malformed: Parameters<typeof fetch> = ['/youtubei/v1/player', { method: 'POST', body: 'invalid' }]
    expect(await noAdFetchArgs(malformed)).toBe(malformed)
  } finally {
    if (saved) Object.defineProperty(globalThis, 'location', saved)
    else delete (globalThis as any).location
  }
})
