import { describe, expect, test } from 'bun:test'
import { parseHTML } from 'linkedom'
import { getVideoLinkTitle } from './link-title'

const resolve = (html: string, url = 'https://m.youtube.com/watch?v=abcdefghijk') => {
  const { document } = parseHTML(html)
  return getVideoLinkTitle(url, document)
}

describe('video link titles', () => {
  test('uses the card heading instead of thumbnail duration or LIVE badge', () => {
    for (const badge of ['20:02', 'LIVE', '']) {
      expect(resolve(`<ytm-rich-item-renderer><ytm-media-item>
        <a href="/watch?v=abcdefghijk&list=WL&index=2">${badge}</a>
        <h3><a href="/watch?v=abcdefghijk">A real video title</a></h3>
        <span>Channel name • 2 weeks ago</span>
      </ytm-media-item></ytm-rich-item-renderer>`)).toBe('A real video title')
    }
  })

  test('finds the selected video, rather than the first or currently playing video', () => {
    expect(resolve(`<ytm-compact-video-renderer><a href="/watch?v=other_video">LIVE</a><h4>Other video</h4></ytm-compact-video-renderer>
      <ytm-compact-video-renderer><a href="/watch?v=abcdefghijk">1:02:03</a><h4>Selected &amp; saved</h4></ytm-compact-video-renderer>`)).toBe('Selected & saved')
  })

  test('handles playlist, desktop, Shorts, and music cards', () => {
    for (const card of ['ytm-playlist-video-renderer', 'ytd-video-renderer', 'yt-lockup-view-model', 'ytmusic-responsive-list-item-renderer']) {
      expect(resolve(`<${card}><a href="/shorts/abcdefghijk">0:30</a><h3>Title 🎵</h3></${card}>`)).toBe('Title 🎵')
    }
  })

  test('falls back to a title attribute or title link text without saving badges', () => {
    expect(resolve('<a href="/watch?v=abcdefghijk" title="Full title">20:02</a>')).toBe('Full title')
    expect(resolve('<a href="/watch?v=abcdefghijk">LIVE</a><a href="/watch?v=abcdefghijk">Full title</a>')).toBe('Full title')
    expect(resolve('<a href="/watch?v=abcdefghijk">20:02</a>')).toBe('')
  })

  test('ignores unrelated URLs and links to another video', () => {
    expect(resolve('<a href="https://example.com/watch?v=abcdefghijk">Unrelated title</a>')).toBe('')
    expect(resolve('<a href="/watch?v=other_video">Other title</a>')).toBe('')
    expect(resolve('<a href="/watch?v=abcdefghijk">Title</a>', 'bad url')).toBe('')
  })
})
