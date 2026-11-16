import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import { noAdPlayerJson, noAdWatchUrl } from '../lib/no-ad-request'

// Keep gzip bodies gzipped so XHR can retain its existing Content-Encoding.
// This is synchronous as send() must also keep supporting synchronous XHRs.
export function noAdRequestBody(endpoint: string, body: unknown): string | Uint8Array | null {
  try {
    if (typeof body === 'string') return noAdPlayerJson(endpoint, body)
    const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) :
      ArrayBuffer.isView(body) ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength) : null
    if (!bytes) return null
    const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
    const json = noAdPlayerJson(endpoint, strFromU8(gzipped ? gunzipSync(bytes) : bytes))
    return json === null ? null : gzipped ? gzipSync(strToU8(json)) : json
  } catch {
    // A new payload format must not prevent playback.
    return null
  }
}

export async function noAdFetchArgs(args: Parameters<typeof fetch>): Promise<Parameters<typeof fetch>> {
  const [input, init] = args
  const url = new URL(input instanceof Request ? input.url : input.toString(), location.href)
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) return args
  const endpoint = url.pathname.match(/^\/youtubei\/v1\/(player|get_watch)$/)?.[1]
  if (!endpoint) return args
  try {
    const request = new Request(input instanceof Request ? input.clone() : url.href, init)
    if (request.method !== 'POST') return args
    const body = noAdRequestBody(endpoint, await request.clone().arrayBuffer())
    if (body !== null) return [new Request(request, { body: body as BodyInit })]
  } catch {}
  return args
}

export function installNoAdWatchLinks() {
  // Reload and back/forward can bypass both native loadUrl and link clicks.
  // A document restored with our old parameter must respect the current opt-out.
  if (window.NouTube?.getSettings?.()?.blockAds === false) {
    const current = new URL(location.href)
    const cleaned = noAdWatchUrl(current.href, false)
    if (cleaned && cleaned !== current.href) location.replace(cleaned)
  }
  // Modify the destination before either YouTube's router or the browser sees
  // the click. Native-issued document loads are covered by watchLoadUrl too.
  document.addEventListener('click', (event) => {
    const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined
    if (!link) return
    const url = noAdWatchUrl(link.href, window.NouTube?.getSettings?.()?.blockAds !== false)
    if (url) link.href = url
  }, true)
}
