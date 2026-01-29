import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import { ui$ } from '@/states/ui'
import { isWeb } from './utils'

export async function getWatchPageBookmark(url: string) {
  const bookmark = newBookmark({ url })
  const webview = ui$.webview.get()
  const title = await webview?.executeJavaScript('document.title')
  const data = await webview?.executeJavaScript(
    `document.querySelector('#movie_player').getPlayerResponse()?.videoDetails`,
  )
  try {
    const { author, title, thumbnail } = typeof data == 'string' ? JSON.parse(data) : data
    if (author && title) {
      bookmark.title = `${title} - ${author}`
      bookmark.json.thumbnail = thumbnail?.thumbnails?.at(-1)?.url
    }
    return bookmark
  } catch (e) {
    console.log(e, data)
  }
  return bookmark
}
