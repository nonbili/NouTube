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
    console.error(e, data)
  }
  return bookmark
}

const chromeVersion = 142

export function getUserAgent() {
  let detail = 'Linux; Android 10; K'
  let mobile = 'Mobile '
  if (isWeb) {
    const platform = window.electron.process.platform
    detail =
      {
        darwin: 'Macintosh; Intel Mac OS X 10_15_7',
        linux: 'X11; Linux x86_64',
      }[platform] || 'Windows NT 10.0; Win64; x64'
    mobile = ''
  }
  return `Mozilla/5.0 (${detail}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 ${mobile}Safari/537.36`
}
