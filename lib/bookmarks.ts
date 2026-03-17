import { settings$ } from '@/states/settings'
import { ui$ } from '@/states/ui'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { fixPageTitle, getPageType } from './page'
import { getWatchPageBookmark } from './webview'
import { fetchYouTubeChannelMetadata } from './youtube-channel'

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
            `document.querySelector('ytmusic-immersive-header-renderer h1')?.textContent?.trim()`,
          )
          const thumbnail = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-immersive-header-renderer img')?.src`,
          )
          if (title && title !== 'null') {
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
            `document.querySelector('ytmusic-responsive-header-renderer h1')?.textContent?.trim()`,
          )
          let author = await noutube?.executeJavaScript(
            `document.querySelector('ytmusic-responsive-header-renderer .strapline-text')?.textContent?.trim()`,
          )
          if (title) {
            bookmark.title = title
            if (author && author !== 'null') {
              bookmark.title += ` - ${author}`
            }
          }
          break
        }
      }
    } else if (pageType?.type === 'channel') {
      const metadata = await fetchYouTubeChannelMetadata(bookmark.url)
      if (metadata.title) {
        bookmark.title = metadata.title
      }
      if (metadata.id) {
        bookmark.json.id = metadata.id
      }
      if (metadata.thumbnail) {
        bookmark.json.thumbnail = metadata.thumbnail
      }

      // DOM fallback for platforms where cross-origin fetch is unavailable.
      if (!bookmark.json.id) {
        const feedUrl = await noutube?.executeJavaScript(
          `document.querySelector('link[type="application/rss+xml"]')?.href`,
        )
        if (feedUrl) {
          const id = new URL(feedUrl).searchParams.get('channel_id')
          if (id) {
            bookmark.json.id = id
          }
        }
      }
      if (!bookmark.json.thumbnail) {
        const thumbnail = await noutube?.executeJavaScript(
          `document.querySelector('yt-page-header-view-model yt-avatar-shape img')?.src`,
        )
        bookmark.json.thumbnail = thumbnail
      }
    } else if (pageType?.type === 'playlist') {
      const thumbnail = await noutube?.executeJavaScript(
        `document.querySelector('yt-content-preview-image-view-model img.ytCoreImageLoaded')?.src`,
      )
      bookmark.json.thumbnail = thumbnail
    }
  }
  bookmarks$.toggleBookmark(bookmark)
}
