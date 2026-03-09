import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import pp from 'papaparse'
import * as cheerio from 'cheerio/slim'
import { getPageType, getVideoThumbnail } from './page'
import { showToast } from './toast'
import { normalizeUrl } from './url'
import JSZip from 'jszip'
import { folders$ } from '@/states/folders'

async function getOg(
  url: string,
  type: string,
  retries = 2,
): Promise<{ thumbnail?: string; title?: string }> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const html = await res.text()
      const $ = cheerio.load(html)

      const title = $('meta[property="og:title"]').attr('content')
      const thumbnail = $('meta[property="og:image"]').attr('content') || $('meta[property="og:thumbnail"]').attr('content')
      
      if (title || thumbnail) {
        return { title, thumbnail }
      }
    } catch (e) {
      console.error(`Attempt ${i + 1} failed for ${url}:`, e)
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  // Fallback for YouTube channels if we have the ID in the URL or can derive it
  if (type === 'yt-channel') {
    const channelId = new URL(url).pathname.split('/').pop()
    if (channelId?.startsWith('UC')) {
      return {
        thumbnail: `https://www.youtube.com/s/desktop/28b8682e/img/favicon_144x144.png`, // Generic fallback or we could use a better one if known
      }
    }
  }

  return {}
}

/**
 * Visit https://myaccount.google.com/u/0/yourdata/youtube, in the "Your YouTube
 * dashboard" panel, click More -> Download Data. You will get a few csv files.
 */
export async function importCsv(csv: string, filename?: string) {
  const res = pp.parse<string[]>(csv.trim())
  if (!res.data || res.data.length < 2) return

  const [col0, col1] = res.data[0]
  const items = res.data.slice(1)

  let bookmarks: Bookmark[] = []
  const col0Lower = col0?.toLowerCase()
  const col1Lower = col1?.toLowerCase()

  if (col0Lower === 'channel id' && col1Lower === 'channel url') {
    // subscriptions.csv
    for (const [id, url, title] of items) {
      if (!id || !url) continue
      const { thumbnail } = await getOg(url, 'yt-channel')
      bookmarks.push(newBookmark({ url, title, json: { thumbnail, id } }))
    }
  } else if (col0Lower === 'video id') {
    if (col1Lower === 'playlist video creation timestamp') {
      // YouTube [playlist]-videos.csv
      for (const [id] of items) {
        if (!id) continue
        const url = `https://m.youtube.com/watch?v=${id}`
        const { thumbnail, title } = await getOg(url, 'yt-video')
        let folder = undefined
        if (filename) {
          const playlistName = filename?.split('-')[0]
          if (playlistName) {
            folder = folders$.getOrCreateFolder('watch', playlistName)
          }
        }
        bookmarks.push(newBookmark({ url, title: title || '', json: { folder: folder?.id } }))
      }
    } else if (col1Lower === 'song title') {
      // "music library songs.csv"
      for (const [id, title] of items) {
        if (!id) continue
        const url = `https://music.youtube.com/watch?v=${id}`
        bookmarks.push(newBookmark({ url, title }))
      }
    }
  } else {
    console.log('failed to parse', filename, col0, col1)
  }

  if (bookmarks.length) {
    const count = bookmarks$.importBookmarks(bookmarks)
    showToast(`🎉 Imported ${count} links from ${filename}`)
  }
}

export async function importZip(zip: JSZip) {
  const promises: Promise<void>[] = []
  zip.forEach((_, file) => {
    const slugs = file.name.split('/')
    // Takeout/YouTube and YouTube Music/channels/channel.csv
    const folder = slugs[2]
    if (file.name.endsWith('.csv') && ['music (library and uploads)', 'playlists', 'subscriptions'].includes(folder)) {
      const fn = async () => {
        const csv = await file.async('string')
        await importCsv(csv, slugs.at(-1))
      }
      promises.push(fn())
    }
  })
  await Promise.all(promises)
}

export async function importList(list: string) {
  let sep = list.includes('\r\n') ? '\r\n' : '\n'
  const lines = list.split(sep)
  let bookmarks: Bookmark[] = []
  for (const line of lines) {
    const pageType = getPageType(line)
    if (!pageType?.canStar) {
      continue
    }
    const url = normalizeUrl(line)
    let type = `${pageType.home}-${pageType.type}`
    const { thumbnail, title } = await getOg(url, type)
    bookmarks.push(newBookmark({ url, title: title || '', json: { thumbnail } }))
  }

  if (bookmarks.length) {
    const count = bookmarks$.importBookmarks(bookmarks)
    showToast(`🎉 Imported ${count} pages`)
  }
}
