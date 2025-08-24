import { app, net, protocol, session } from 'electron'
import * as cheerio from 'cheerio'
import { transformPlayerResponse } from '../../../../lib/ad'

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
    try {
      if (pathname.startsWith('/watch')) {
        const text = await res.text()
        return new Response(transformHtml(text), {
          status: res.status,
          headers: res.headers,
        })
      } else if (pathname.startsWith('/youtubei/v1/player')) {
        const text = await res.text()
        return new Response(transformPlayerResponse(text), {
          status: res.status,
          headers: res.headers,
        })
      }
    } catch (e) {
      console.error(e)
    }
    return res
  })
}
