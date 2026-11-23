import { net, session } from 'electron'
import {
  RE_INTERCEPT,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerResponse,
  transformReelResponse,
  transformSearchResponse,
} from 'noutube/lib/intercept'
import { transformWatchResponseStream } from 'noutube/lib/watch-response-stream'
import { transformHtmlStream } from './html-stream'
import { noAdPlayerRequestBody, noAdWatchUrl } from './no-ad-request'
import { createDefaultBlocklistSnapshot, normalizeBlocklist, type BlocklistSnapshot } from 'noutube/lib/blocklist'

let currentBlocklist = createDefaultBlocklistSnapshot()
// Ad blocking is opt-out and separate from the interception itself, which the
// blocklist and the title rewriting need either way (see states/settings.ts).
let transformOptions = { blockAds: true }

export function setInterceptionBlocklist(blocklist?: BlocklistSnapshot) {
  currentBlocklist = normalizeBlocklist(blocklist)
}

export function setInterceptionBlockAds(enabled: boolean) {
  transformOptions = { blockAds: enabled !== false }
}

// ytInitialData carries the server-rendered feed (home, subscriptions, watch
// sidebar), which is where feed ads and blocklisted items come from on first
// paint; continuations go through /youtubei/v1/browse below.
function transformHtml(body: ReadableStream<Uint8Array>) {
  const options = transformOptions
  const blocklist = currentBlocklist
  return transformHtmlStream(body, {
    ytInitialData: (json) => transformBrowseResponse(json, blocklist, options),
    ytInitialPlayerResponse: (json) => transformPlayerResponse(json, undefined, options),
  })
}

function isYouTubeHost(url: string) {
  try {
    const { hostname } = new URL(url)
    return hostname === 'youtube.com' || hostname.endsWith('.youtube.com')
  } catch {
    return false
  }
}

function getTransformTarget(url: string) {
  const { hostname, pathname } = new URL(url)
  const isYT = hostname === 'youtube.com' || hostname.endsWith('.youtube.com')
  if (!isYT) {
    return null
  }

  const match = pathname.match(RE_INTERCEPT)
  if (pathname.startsWith('/watch') || match) {
    return { pathname, match }
  }

  return null
}

// Any YouTube page navigation, so the server-rendered ytInitialData of the home
// feed gets filtered too, not just /watch.
function isDocumentRequest(req: Request) {
  if (req.method !== 'GET') {
    return false
  }
  return (req.headers.get('accept') || '').includes('text/html')
}

async function requestWithoutAds(req: Request, endpoint: string | undefined, isDocument: boolean) {
  try {
    if (isDocument) {
      const url = noAdWatchUrl(req.url)
      return url ? new Request(url, req) : req
    }
    if (req.method === 'POST' && (endpoint === 'player' || endpoint === 'get_watch')) {
      const body = noAdPlayerRequestBody(
        endpoint,
        new Uint8Array(await req.clone().arrayBuffer()),
        req.headers.get('content-encoding'),
      )
      if (body) {
        const headers = new Headers(req.headers)
        headers.delete('content-encoding')
        headers.delete('content-length')
        return new Request(req.url, { method: req.method, headers, body })
      }
    }
  } catch (e) {
    console.error(`Failed to request ${req.url} without ads:`, e)
  }
  return req
}

export function interceptHttpRequest() {
  const ses = session.fromPartition('persist:webview')

  if (ses.protocol.isProtocolHandled('https')) {
    return
  }

  ses.protocol.handle('https', async (req) => {
    // Keep signed media/CDN requests out of YouTube session rewriting.
    if (!isYouTubeHost(req.url)) {
      return net.fetch(req, {
        bypassCustomProtocolHandlers: true,
      })
    }

    const target = getTransformTarget(req.url)
    const isDocument = isDocumentRequest(req)
    if (!target && !isDocument) {
      return ses.fetch(req, {
        bypassCustomProtocolHandlers: true,
      })
    }

    let res: Response
    try {
      const upstream = transformOptions.blockAds ? await requestWithoutAds(req, target?.match?.[1], isDocument) : req
      res = await ses.fetch(upstream, {
        bypassCustomProtocolHandlers: true,
      })
    } catch (e) {
      console.error(`Interception fetch failed for ${req.url}:`, e)
      return Response.error()
    }

    const isHtml = (res.headers.get('content-type') || '').includes('text/html')
    if (res.status > 200 || (!isHtml && !target?.match)) {
      return res
    }

    const match = target?.match
    const headers = new Headers(res.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    headers.delete('transfer-encoding')
    const responseInit = {
      status: res.status,
      headers,
    }
    if (isHtml && res.body) {
      return new Response(transformHtml(res.body), responseInit)
    }
    if (match?.[1] === 'get_watch' && res.body) {
      const options = transformOptions
      return new Response(
        transformWatchResponseStream(res.body, (text) => transformGetWatchResponse(text, options)),
        responseInit,
      )
    }

    const text = await res.text()
    try {
      if (match) {
        switch (match[1]) {
          case 'browse':
          case 'next':
            return new Response(transformBrowseResponse(text, currentBlocklist, transformOptions), responseInit)
          case 'search':
            return new Response(transformSearchResponse(text, currentBlocklist, transformOptions), responseInit)
          case 'get_watch':
            return new Response(transformGetWatchResponse(text, transformOptions), responseInit)
          case 'reel':
            return new Response(transformReelResponse(text, currentBlocklist, transformOptions), responseInit)
          default:
            return new Response(transformPlayerResponse(text, undefined, transformOptions), responseInit)
        }
      }
    } catch (e) {
      console.error(e)
    }
    return new Response(text, responseInit)
  })
}

export function toggleInterception(enabled: boolean) {
  if (enabled) {
    interceptHttpRequest()
  } else {
    const ses = session.fromPartition('persist:webview')
    if (ses.protocol.isProtocolHandled('https')) {
      ses.protocol.unhandle('https')
    }
  }
}
