import { Bookmark, watchlist$ } from '@/states/watchlist'
import pp from 'papaparse'
import { ToastAndroid } from 'react-native'
import * as cheerio from 'cheerio/slim'
import { getVideoThumbnail } from './page'

async function getOg(url: string, type: string, videoId?: string): Promise<{ thumbnail?: string; title?: string }> {
  try {
    const res = await fetch(url)
    const html = await res.text()
    const $ = cheerio.load(html)

    switch (type) {
      case 'yt-channel':
        const thumbnail = $('meta[property="og:thumbnail"]').attr('content')
        return { thumbnail }
      case 'yt-video':
        const title = $('meta[property="og:title"]').attr('content')
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
export async function importCsv(csv: string) {
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
          bookmarks.push({ url, title, thumbnail })
        }
      }
      break
    case 'Video ID':
      if (col1 == 'Playlist Video Creation Timestamp') {
        // YouTube [playlist]-videos.csv
        for (const [id] of items) {
          const url = `https://m.youtube.com/watch?v=${id}`
          const { thumbnail, title } = await getOg(url, 'yt-video')
          bookmarks.push({ url, title: title || '' })
        }
      } else if (col1 == 'Song Title') {
        // "music library songs.csv"
        for (const [id, title] of items) {
          const url = `https://music.youtube.com/watch?v=${id}`
          bookmarks.push({ url, title })
        }
      }
      break
  }

  if (bookmarks.length) {
    const count = watchlist$.importBookmarks(bookmarks)
    ToastAndroid.show(`🎉 Imported ${count} pages`, ToastAndroid.SHORT)
  }
}
