import * as cheerio from 'cheerio/slim'

export interface YouTubeChannelMetadata {
  id?: string
  thumbnail?: string
  title?: string
}

function normalizeYouTubeTitle(title: string) {
  return title.replace(/ - YouTube( Music)*$/, '')
}

export function extractYouTubeChannelMetadata(html: string): YouTubeChannelMetadata {
  const $ = cheerio.load(html)

  const feedUrl =
    $('link[type="application/rss+xml"]').attr('href') || $('link[rel="alternate"][type="application/rss+xml"]').attr('href')

  let id: string | undefined
  if (feedUrl) {
    try {
      id = new URL(feedUrl, 'https://www.youtube.com').searchParams.get('channel_id') || undefined
    } catch {}
  }

  const thumbnail =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[property="og:thumbnail"]').attr('content') ||
    $('link[itemprop="thumbnailUrl"]').attr('href') ||
    undefined

  const rawTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content') || undefined
  const title = rawTitle ? normalizeYouTubeTitle(rawTitle) : undefined

  return { id, thumbnail, title }
}

export async function fetchYouTubeChannelMetadata(url: string, retries = 2): Promise<YouTubeChannelMetadata> {
  for (let index = 0; index < retries; index += 1) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`)
      }

      const metadata = extractYouTubeChannelMetadata(await res.text())
      if (metadata.id || metadata.thumbnail || metadata.title) {
        return metadata
      }
    } catch (error) {
      console.error(`Failed to fetch channel metadata for ${url} (attempt ${index + 1})`, error)
      if (index < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (index + 1)))
      }
    }
  }

  return {}
}
