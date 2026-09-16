import { describe, expect, it } from 'bun:test'
import { getBookmarkKey, normalizeUrl } from './url'

describe('normalizeUrl', () => {
  it('moves youtube hosts to the mobile one', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc')).toBe('https://m.youtube.com/watch?v=abc')
    expect(normalizeUrl('https://music.youtube.com/watch?v=abc')).toBe('https://music.youtube.com/watch?v=abc')
  })

  it('drops app and tracking params', () => {
    expect(normalizeUrl('https://m.youtube.com/watch?v=abc&app=desktop&pp=xyz&si=123')).toBe(
      'https://m.youtube.com/watch?v=abc',
    )
  })

  it('turns a share link into a watch url', () => {
    expect(normalizeUrl('https://youtu.be/abc?si=123')).toBe('https://m.youtube.com/watch?v=abc')
  })
})

describe('getBookmarkKey', () => {
  const watch = 'https://m.youtube.com/watch?v=abc'

  it('matches the same video across hosts, paths and params', () => {
    expect(getBookmarkKey('https://www.youtube.com/watch?v=abc')).toBe(watch)
    expect(getBookmarkKey('https://m.youtube.com/watch?v=abc&t=42s&pp=xyz')).toBe(watch)
    expect(getBookmarkKey('https://www.youtube.com/watch?v=abc&list=PL1&index=3')).toBe(watch)
    expect(getBookmarkKey('https://youtu.be/abc?si=123')).toBe(watch)
    expect(getBookmarkKey('https://m.youtube.com/shorts/abc')).toBe(watch)
  })

  it('keeps youtube music apart from youtube', () => {
    expect(getBookmarkKey('https://music.youtube.com/watch?v=abc&list=RDAMVMabc')).toBe(
      'https://music.youtube.com/watch?v=abc',
    )
  })

  it('keeps different videos apart', () => {
    expect(getBookmarkKey('https://m.youtube.com/watch?v=xyz')).not.toBe(watch)
  })

  it('keys a playlist by its list', () => {
    expect(getBookmarkKey('https://www.youtube.com/playlist?list=PL1&foo=bar')).toBe(
      'https://m.youtube.com/playlist?list=PL1',
    )
    expect(getBookmarkKey('https://music.youtube.com/playlist?list=PL2')).toBe(
      'https://music.youtube.com/playlist?list=PL2',
    )
  })

  it('keys a channel by the channel, not the open tab', () => {
    expect(getBookmarkKey('https://www.youtube.com/@name/videos')).toBe('https://m.youtube.com/@name')
    expect(getBookmarkKey('https://m.youtube.com/channel/UC123/streams')).toBe('https://m.youtube.com/channel/UC123')
    expect(getBookmarkKey('https://m.youtube.com/@name/')).toBe('https://m.youtube.com/@name')
  })

  it('survives what is not a url', () => {
    expect(getBookmarkKey('')).toBe('')
    expect(getBookmarkKey('not a url')).toBe('not a url')
  })
})
