import { settings$ } from '@/states/settings'
import { ui$ } from '@/states/ui'
import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import { fixPageTitle, getPageType } from './page'
import { genId } from './utils'
import { getWatchPageBookmark } from './webview'

export async function toggleStar(noutube: any, starred: boolean) {
  const isYTMusic = settings$.isYTMusic.get()
  const uiState = ui$.get()
  const pageType = getPageType(uiState.pageUrl)
  let bookmark = newBookmark({ url: uiState.pageUrl })

  if (!starred) {
    bookmark.title = fixPageTitle((await noutube?.executeJavaScript('document.title')) || '')
    if (isYTMusic) {
      switch (pageType?.type) {
        case 'watch': {
          bookmark = await getWatchPageBookmark(uiState.pageUrl)
          break
        }
        case 'channel': {
          const title = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-immersive-header-renderer h1')?.innerText`,
          )
          const thumbnail = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-immersive-header-renderer img')?.src`,
          )
          if (title && title != 'null') {
            bookmark.title = title
            bookmark.json.thumbnail = thumbnail
          }
          break
        }
        case 'podcast':
        case 'playlist': {
          const thumbnail = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-responsive-header-renderer ytmusic-thumbnail-renderer.thumbnail img')?.src`,
          )
          bookmark.json.thumbnail = thumbnail
          const title = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-responsive-header-renderer h1')?.innerText`,
          )
          let author = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-responsive-header-renderer .strapline-text')?.innerText`,
          )
          if (title) {
            bookmark.title = title
            if (author && author != 'null') {
              author = author.replaceAll('\\n', '')
              bookmark.title += ` - ${author}`
            }
          }
          break
        }
      }
    } else if (pageType?.type == 'channel') {
      const thumbnail = await noutube?.executeJavaScript(
        `document.querySelector('yt-page-header-view-model yt-avatar-shape img')?.src`,
      )
      bookmark.json.thumbnail = thumbnail
    } else if (pageType?.type == 'playlist') {
      const thumbnail = await noutube?.executeJavaScript(
        `document.querySelector('yt-content-preview-image-view-model img.ytCoreImageLoaded')?.src`,
      )
      bookmark.json.thumbnail = thumbnail
    }
  }
  bookmarks$.toggleBookmark(bookmark)
}
