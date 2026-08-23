import { delay } from 'es-toolkit'
import { ui$ } from '@/states/ui'
import { mainClient, type FormatOption } from './main-client'
import { buildFormatOptionsFromPlayer, type PlayerFormatsPayload } from './player-formats'

const VIDEO_ID = /^[\w-]{6,20}$/
const PATH_ID = /\/(?:shorts|embed|live|v)\/([\w-]{6,20})/

const YOUTUBE_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be']

// A watch-shaped URL on somebody else's domain is not a YouTube video: without this check the
// page would happily resolve the id against YouTube and the modal would offer the formats of an
// unrelated video, whose itags then go to yt-dlp along with the original URL.
const isYouTubeHost = (host: string) =>
  YOUTUBE_HOSTS.some((youtube) => host === youtube || host.endsWith(`.${youtube}`))

export const parseVideoId = (url: string): string => {
  try {
    const parsed = new URL(url)
    if (!isYouTubeHost(parsed.host)) return ''
    const fromQuery = parsed.searchParams.get('v')
    if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery
    if (parsed.host === 'youtu.be' || parsed.host.endsWith('.youtu.be')) {
      const id = parsed.pathname.slice(1)
      return VIDEO_ID.test(id) ? id : ''
    }
    const fromPath = parsed.pathname.match(PATH_ID)?.[1]
    return fromPath ?? ''
  } catch {
    return ''
  }
}

// Both bridges await a promise: Electron's resolves whatever the expression returns, and the
// Android module has executeJavaScriptAsync for it (a plain executeJavaScript there answers with
// the JSON of the promise itself). Android hands back the JSON text of the result, desktop the
// value itself.
const evalJson = async (webview: any, script: string) => {
  const evaluate = webview.executeJavaScriptAsync ?? webview.executeJavaScript
  const raw = await evaluate.call(webview, script)
  if (raw == null || raw === '' || raw === 'null') return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// Reads the format list out of the webview, where YouTube has already published it. Returns
// undefined whenever the page cannot answer — a non-YouTube page, a video that needs the login
// cookies, an unplayable one — so the caller falls back to yt-dlp.
const listFormatsFromWebview = async (url: string) => {
  const videoId = parseVideoId(url)
  const webview = ui$.webview.get()
  if (!videoId || typeof webview?.executeJavaScript !== 'function') return undefined

  const payload: PlayerFormatsPayload | null = await evalJson(
    webview,
    `window.NouTube?.getPlayerFormats?.('${videoId}') ?? null`,
  )
  return buildFormatOptionsFromPlayer(payload)
}

// A page that goes quiet — the bridge waits far longer than that before giving up — should not
// hold up the format list any longer than asking yt-dlp in the first place would have.
const WEBVIEW_TIMEOUT_MS = 5000

export const listFormats = async (
  url: string,
  useCookies: boolean,
): Promise<{ title: string; formats: FormatOption[] }> => {
  const fromWebview = await Promise.race([
    listFormatsFromWebview(url).catch(() => undefined),
    delay(WEBVIEW_TIMEOUT_MS).then(() => undefined),
  ])
  if (fromWebview) return fromWebview
  return mainClient.listFormats(url, useCookies)
}
