import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import pp from 'papaparse'
import * as cheerio from 'cheerio/slim'
import { getPageType, getVideoThumbnail } from './page'
import { showToast } from './toast'
import { normalizeUrl } from './url'
import JSZip from 'jszip'
import { folders$ } from '@/states/folders'

async function getOg(url: string, type: string, videoId?: string): Promise<{ thumbnail?: string; title?: string }> {
  try {
    const res = await fetch(url)
    const html = await res.text()
    const $ = cheerio.load(html)

    const title = $('meta[property="og:title"]').attr('content')
    switch (type) {
      case 'yt-channel':
        const thumbnail = $('meta[property="og:thumbnail"]').attr('content')
        return { title, thumbnail }
      default:
        return {
          title,
        }
    }
  } catch (e) {
    console.error(e)
  }
  return {}
}

/**
 * Visit https://myaccount.google.com/u/0/yourdata/youtube, in the "Your YouTube
 * dashboard" panel, click More -> Download Data. You will get a few csv files.
 */
export async function importCsv(csv: string, filename?: string) {
  const res = pp.parse<string[]>(csv.trim())

  const [col0, col1, col2] = res.data[0]
  const items = res.data.slice(1)

  let bookmarks: Bookmark[] = []
  switch (col0) {
    case 'Channel Id':
      if (col1 == 'Channel Url') {
        // subscriptions.csv
        for (const [id, url, title] of items) {
          const { thumbnail } = await getOg(url, 'yt-channel')
          bookmarks.push(newBookmark({ url, title, json: { thumbnail } }))
        }
      }
      break
    case 'Video ID':
      if (col1 == 'Playlist Video Creation Timestamp') {
        // YouTube [playlist]-videos.csv
        for (const [id] of items) {
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
      } else if (col1 == 'Song Title') {
        // "music library songs.csv"
        for (const [id, title] of items) {
          const url = `https://music.youtube.com/watch?v=${id}`
          bookmarks.push(newBookmark({ url, title }))
        }
      }
      break
    default:
      console.log('failed to parse', filename)
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
