import { app, net, protocol, session } from 'electron'
import * as cheerio from 'cheerio'
import { RE_INTERCEPT, transformPlayerResponse, transformSearchResponse } from '../../../../lib/intercept'

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
  ses.protocol.handle('https', async (req) => {
    const res = await net.fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      // @ts-expect-error
      duplex: 'half',
    })
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
        return new Response(
          match[1] == 'search' ? transformSearchResponse(text) : transformPlayerResponse(text),
          responseInit,
        )
      }
    } catch (e) {
      console.error(e)
    }
    return new Response(text, responseInit)
  })
}
