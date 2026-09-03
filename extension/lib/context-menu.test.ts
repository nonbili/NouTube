import { describe, expect, it } from 'bun:test'
import { isSaveableBookmarkUrl, SAVE_BOOKMARK_LINK_MATCHES } from './context-menu'

describe('bookmark context menu', () => {
  it.each([
    'https://www.youtube.com/watch?v=video',
    'https://www.youtube.com/shorts/video',
    'https://www.youtube.com/@Reuters',
    'https://www.youtube.com/channel/UC123',
    'https://www.youtube.com/c/Reuters',
    'https://www.youtube.com/user/Reuters',
    'https://www.youtube.com/playlist?list=PL123',
    'https://music.youtube.com/playlist?list=PL123',
  ])('accepts %s', (url) => {
    expect(isSaveableBookmarkUrl(url)).toBe(true)
  })

  it.each([
    'https://www.youtube.com/',
    'https://www.youtube.com/results?search_query=news',
    'https://example.com/@Reuters',
  ])('rejects %s', (url) => {
    expect(isSaveableBookmarkUrl(url)).toBe(false)
  })

  it('registers target patterns for channel handles and playlists', () => {
    expect(SAVE_BOOKMARK_LINK_MATCHES).toContain('https://www.youtube.com/@*')
    expect(SAVE_BOOKMARK_LINK_MATCHES).toContain('https://www.youtube.com/playlist*')
  })
})
