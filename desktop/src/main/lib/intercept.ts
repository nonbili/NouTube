import { app, net, protocol, session } from 'electron'
import * as cheerio from 'cheerio'
import {
  RE_INTERCEPT,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerResponse,
  transformSearchResponse,
} from 'noutube/lib/intercept'
import { createDefaultBlocklistSnapshot, normalizeBlocklist, type BlocklistSnapshot } from 'noutube/lib/blocklist'

let currentBlocklist = createDefaultBlocklistSnapshot()

export function setInterceptionBlocklist(blocklist?: BlocklistSnapshot) {
  currentBlocklist = normalizeBlocklist(blocklist)
}

function transformHtml(html: string) {
  const $ = cheerio.load(html)
  const scripts = $('script')
  for (const script of scripts) {
    const text = $(script).text()
    if (text.includes('var ytInitialPlayerResponse')) {
      const start = text.indexOf('=')
      const end = text.indexOf(';var ', start)
      const res = transformPlayerResponse(text.slice(start + 1, end))
      $(script).html(`var ytInitialPlayerResponse = ${res};${text.slice(end)}`)
    }
  }
  return $.html()
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
    let res: Response
    try {
      res = await ses.fetch(req, {
        bypassCustomProtocolHandlers: true,
      })
    } catch (e) {
      console.error(`Interception fetch failed for ${req.url}:`, e)
      return Response.error()
    }

    const { pathname } = new URL(req.url)
    const match = pathname.match(RE_INTERCEPT)
    if (res.status > 200 || (!pathname.startsWith('/watch') && !match)) {
      return res
    }

    const text = await res.text()
    const responseInit = {
      status: res.status,
      headers: res.headers,
    }
    try {
      if (pathname.startsWith('/watch')) {
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
            return new Response(transformPlayerResponse(text), responseInit)
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
