import { net, session } from 'electron'
import {
  RE_INTERCEPT,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerRequest,
  transformPlayerResponse,
  transformSearchResponse,
} from 'noutube/lib/intercept'
import { createDefaultBlocklistSnapshot, normalizeBlocklist, type BlocklistSnapshot } from 'noutube/lib/blocklist'

let currentBlocklist = createDefaultBlocklistSnapshot()
let ytMusicAudioOnly = false

export function setInterceptionBlocklist(blocklist?: BlocklistSnapshot) {
  currentBlocklist = normalizeBlocklist(blocklist)
}

export function setYTMusicAudioOnly(enabled: boolean) {
  ytMusicAudioOnly = Boolean(enabled)
}

function shouldUseYTMusicAudioOnly(url: string) {
  try {
    return ytMusicAudioOnly && new URL(url).hostname === 'music.youtube.com'
  } catch {
    return false
  }
}

function findJsonBounds(text: string, startIndex: number) {
  let braceCount = 0
  let inString = false
  let stringChar = ''
  let escaped = false
  const jsonStart = text.indexOf('{', startIndex)
  if (jsonStart === -1) return null

  for (let i = jsonStart; i < text.length; i++) {
    const char = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (inString) {
      if (char === stringChar) {
        inString = false
      }
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = true
      stringChar = char
      continue
    }
    if (char === '{') {
      braceCount++
    } else if (char === '}') {
      braceCount--
      if (braceCount === 0) {
        return { start: jsonStart, end: i + 1 }
      }
    }
  }
  return null
}

// JSON.stringify happily emits `<`, which would end the inline <script> early.
// YouTube itself escapes these, so mirror that.
function escapeForScriptTag(json: string) {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

function transformEmbeddedJson(html: string, key: string, transform: (json: string) => string) {
  let index = html.indexOf(`var ${key} =`)
  if (index === -1) {
    index = html.indexOf(`${key} =`)
    if (index === -1) {
      return html
    }
  }

  const bounds = findJsonBounds(html, index)
  if (!bounds) {
    return html
  }

  try {
    const transformed = escapeForScriptTag(transform(html.slice(bounds.start, bounds.end)))
    return html.slice(0, bounds.start) + transformed + html.slice(bounds.end)
  } catch (e) {
    console.error(`Failed to transform ${key} inside HTML:`, e)
    return html
  }
}

function transformHtml(html: string) {
  // ytInitialData carries the server-rendered feed (home, subscriptions, watch
  // sidebar), which is where feed ads and blocklisted items come from on first
  // paint; continuations go through /youtubei/v1/browse below.
  const withoutAds = transformEmbeddedJson(html, 'ytInitialData', (json) =>
    transformBrowseResponse(json, currentBlocklist),
  )
  return transformEmbeddedJson(withoutAds, 'ytInitialPlayerResponse', (json) => transformPlayerResponse(json))
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

export function interceptHttpRequest() {
  const ses = session.fromPartition('persist:webview')

  ses.setCertificateVerifyProc((request, callback) => {
    if (
      request.hostname.endsWith('.youtube.com') ||
      request.hostname.endsWith('.googlevideo.com') ||
      request.hostname.endsWith('.ytimg.com') ||
      request.hostname.endsWith('.ggpht.com') ||
      request.hostname === 'youtube.com'
    ) {
      callback(0)
    } else {
      callback(-3)
    }
  })

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

    let fetchRequest = req
    const audioOnly = shouldUseYTMusicAudioOnly(req.url)
    if (audioOnly && target?.match?.[1] === 'player') {
      try {
        const bodyText = await req.clone().text()
        const body = transformPlayerRequest(bodyText, true)
        if (body !== bodyText) {
          const headers = new Headers(req.headers)
          headers.delete('content-length')
          fetchRequest = new Request(req.url, { method: req.method, headers, body })
        }
      } catch (e) {
        console.error(`Failed to transform YouTube Music request for ${req.url}:`, e)
      }
    }

    let res: Response
    try {
      res = await ses.fetch(fetchRequest, {
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
    const text = await res.text()
    const headers = new Headers(res.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    headers.delete('transfer-encoding')
    const responseInit = {
      status: res.status,
      headers,
    }
    try {
      if (isHtml) {
        return new Response(transformHtml(text), responseInit)
      }

      if (match) {
        switch (match[1]) {
          case 'browse':
          case 'next':
            return new Response(transformBrowseResponse(text, currentBlocklist), responseInit)
          case 'search':
            return new Response(transformSearchResponse(text, currentBlocklist), responseInit)
          case 'get_watch':
            return new Response(transformGetWatchResponse(text), responseInit)
          default:
            return new Response(transformPlayerResponse(text, currentBlocklist, { isYTMusic: audioOnly }), responseInit)
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
