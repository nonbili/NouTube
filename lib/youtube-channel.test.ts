import { describe, expect, it } from 'bun:test'
import { extractYouTubeChannelMetadata } from './youtube-channel'

describe('extractYouTubeChannelMetadata', () => {
  it('extracts channel id, title, and thumbnail from html', () => {
    const metadata = extractYouTubeChannelMetadata(`
      <html>
        <head>
          <meta property="og:title" content="Example Channel - YouTube" />
          <meta property="og:image" content="https://example.com/avatar.jpg" />
          <link type="application/rss+xml" href="https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890" />
        </head>
      </html>
    `)

    expect(metadata).toEqual({
      id: 'UC1234567890',
      thumbnail: 'https://example.com/avatar.jpg',
      title: 'Example Channel',
    })
  })

  it('returns partial metadata when rss is missing', () => {
    const metadata = extractYouTubeChannelMetadata(`
      <html>
        <head>
          <meta property="og:title" content="Fallback Channel - YouTube" />
          <meta property="og:thumbnail" content="https://example.com/thumb.jpg" />
        </head>
      </html>
    `)

    expect(metadata).toEqual({
      id: undefined,
      thumbnail: 'https://example.com/thumb.jpg',
      title: 'Fallback Channel',
    })
  })
})
