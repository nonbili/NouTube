import { describe, expect, test } from 'bun:test'
import { parseVideoId } from './list-formats'

describe('parseVideoId', () => {
  test('reads the id from every watch URL shape', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RD')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  test('returns nothing for pages that are not a video', () => {
    expect(parseVideoId('https://www.youtube.com/feed/subscriptions')).toBe('')
    expect(parseVideoId('not a url')).toBe('')
    expect(parseVideoId("https://www.youtube.com/watch?v=');alert(1)//")).toBe('')
  })

  test('ignores watch-shaped URLs on other domains', () => {
    expect(parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBe('')
    expect(parseVideoId('https://notyoutu.be/dQw4w9WgXcQ')).toBe('')
    expect(parseVideoId('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBe('')
    expect(parseVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
})
