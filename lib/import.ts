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

const channelIdRe = /^UC[A-Za-z0-9_-]{22}$/
const videoIdRe = /^[A-Za-z0-9_-]{11}$/
const isoTimestampRe = /^\d{4}-\d{2}-\d{2}T/

type CsvShape = 'subscriptions' | 'playlist-videos' | 'music-songs' | null

function detectShape(row: string[]): CsvShape {
  const [c0, c1] = row
  if (!c0) return null
  if (channelIdRe.test(c0) && c1 && /youtube\.com\/channel\//i.test(c1)) {
    return 'subscriptions'
  }
  if (videoIdRe.test(c0)) {
    if (c1 && isoTimestampRe.test(c1)) return 'playlist-videos'
    return 'music-songs'
  }
  return null
}

/**
 * Visit https://myaccount.google.com/u/0/yourdata/youtube, in the "Your YouTube
 * dashboard" panel, click More -> Download Data. You will get a few csv files.
 *
 * Detection is based on row shape rather than header text, so localized
 * Takeout exports (non-English column headers and filenames) work too.
 */
export async function importCsv(csv: string, filename?: string): Promise<number> {
  const res = pp.parse<string[]>(csv.trim())
  if (!res.data || res.data.length < 1) return 0

  // First row may be a localized header; skip it if it doesn't match an ID pattern.
  let items = res.data
  if (items[0] && !channelIdRe.test(items[0][0] || '') && !videoIdRe.test(items[0][0] || '')) {
    items = items.slice(1)
  }
  if (!items.length) return 0

  const shape = detectShape(items[0])
  let bookmarks: Bookmark[] = []

  if (shape === 'subscriptions') {
    for (const [id, url, title] of items) {
      if (!id || !url) continue
      const { thumbnail } = await getOg(url, 'yt-channel')
      bookmarks.push(newBookmark({ url, title, json: { thumbnail, id } }))
    }
  } else if (shape === 'playlist-videos') {
    let folder = undefined
    if (filename) {
      const playlistName = filename.split('-')[0]
      if (playlistName) {
        folder = folders$.getOrCreateFolder('watch', playlistName)
      }
    }
    for (const [id] of items) {
      if (!id) continue
      const url = `https://m.youtube.com/watch?v=${id}`
      const { thumbnail, title } = await getOg(url, 'yt-video')
      bookmarks.push(newBookmark({ url, title: title || '', json: { folder: folder?.id } }))
    }
  } else if (shape === 'music-songs') {
    for (const [id, title] of items) {
      if (!id) continue
      const url = `https://music.youtube.com/watch?v=${id}`
      bookmarks.push(newBookmark({ url, title }))
    }
  } else {
    return 0
  }

  if (!bookmarks.length) return 0
  bookmarks$.importBookmarks(bookmarks)
  showToast(`🎉 Imported ${bookmarks.length} links from ${filename}`)
  return bookmarks.length
}

export async function importZip(zip: JSZip) {
  const files: JSZip.JSZipObject[] = []
  zip.forEach((_, file) => {
    // Folder names inside Takeout are localized, so don't filter by them.
    // importCsv detects the CSV type by row shape and ignores the rest.
    if (file.name.toLowerCase().endsWith('.csv')) {
      files.push(file)
    }
  })

  // Process sequentially to save memory
  let total = 0
  for (const file of files) {
    try {
      const csv = await file.async('string')
      const slugs = file.name.split('/')
      total += await importCsv(csv, slugs.at(-1))
      // Small pause to allow GC to work
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (e) {
      console.error(`Failed to process ${file.name} from zip:`, e)
    }
  }
  if (total === 0) {
    showToast("Nothing recognized in zip — make sure it's a YouTube Takeout export")
  }
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
