import { describe, expect, it } from 'bun:test'
import { redirectSystemPath } from '../app/+native-intent'
import { isWatchUrl } from './split-watch-url'
import { expandShortUrl } from './supported-url'

describe('external YouTube routing', () => {
  for (const initial of [true, false]) {
    it(`keeps YouTube links on Home for ${initial ? 'cold' : 'warm'} launches`, () => {
      for (const path of [
        'https://www.youtube.com/watch?v=abc123',
        'https://m.youtube.com/watch?v=abc123',
        'https://youtu.be/abc123',
        'https://music.youtube.com/watch?v=abc123',
        'https://www.youtube.com/shorts/abc123',
        'noutube://www.youtube.com/watch?v=abc123',
      ]) {
        expect(redirectSystemPath({ path, initial })).toBe('/')
      }
    })
  }

  it('preserves authentication and unrelated app paths', () => {
    for (const path of ['noutube:auth?code=example', '/', '/settings', 'https://example.com/watch?v=abc123']) {
      expect(redirectSystemPath({ path, initial: false })).toBe(path)
    }
  })
})

describe('expandShortUrl', () => {
  it('spells youtu.be links out as watch pages the player recognises', () => {
    const expanded = expandShortUrl('https://youtu.be/abc123')
    expect(expanded).toBe('https://www.youtube.com/watch?v=abc123')
    expect(isWatchUrl(expanded)).toBe(true)
  })

  it('keeps the start time and playlist of a share link', () => {
    expect(expandShortUrl('https://youtu.be/abc123?t=42&list=PL1')).toBe(
      'https://www.youtube.com/watch?v=abc123&t=42&list=PL1',
    )
  })

  it('leaves everything else alone', () => {
    for (const url of ['https://youtu.be/', 'https://m.youtube.com/watch?v=abc123', 'noutube:auth?code=example', 'x']) {
      expect(expandShortUrl(url)).toBe(url)
    }
  })
})
