import {
  RE_INTERCEPT,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerResponse,
  transformSearchResponse,
} from '@/lib/intercept'

export function intercept() {
  const winFetch = fetch
  // @ts-expect-error xx
  window.fetch = async (...args) => {
    const request = args[0]
    const url = request instanceof Request ? request.url : request.toString()
    let res = await winFetch(...args)
    const match = new URL(url).pathname.match(RE_INTERCEPT)
    const blocklist = window.NouTube?.getBlocklist?.()
    const hasBlocklist = Boolean(blocklist?.channels?.length || blocklist?.keywords?.length)
    if (res.status > 200 || !match || (match[1] == 'search' && !window.NouTube.shortsHidden && !hasBlocklist)) {
      return res
    }

    const text = await res.text()
    const responseInit = {
      status: res.status,
      headers: res.headers,
    }
    try {
      const fn =
        {
          browse: transformBrowseResponse,
          get_watch: transformGetWatchResponse,
          next: transformBrowseResponse,
          search: (text: string, _blocklist?: any) =>
            transformSearchResponse(text, blocklist, { hideShorts: window.NouTube.shortsHidden }),
        }[match[1]] || transformPlayerResponse
      return new Response(fn(text, blocklist), responseInit)
    } catch (error) {
      console.error('NouScript:', error)
    }
    return new Response(text, responseInit)
  }

  // https://stackoverflow.com/a/78369686
  const xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    url = url.toString()
    this.addEventListener('readystatechange', function () {
      if (this.readyState !== 4) {
        return
      }

      const match = new URL(url, location.origin).pathname.match(RE_INTERCEPT)
      if (!match) {
        return
      }

      const blocklist = window.NouTube?.getBlocklist?.()
      const hasBlocklist = Boolean(blocklist?.channels?.length || blocklist?.keywords?.length)
      if (match[1] == 'search' && !window.NouTube.shortsHidden && !hasBlocklist) {
        return
      }

      try {
        const fn =
          {
            browse: transformBrowseResponse,
            get_watch: transformGetWatchResponse,
            next: transformBrowseResponse,
            search: (text: string, _blocklist?: any) =>
              transformSearchResponse(text, blocklist, { hideShorts: window.NouTube.shortsHidden }),
          }[match[1]] || transformPlayerResponse
        const text = fn(this.responseText, blocklist)
        Object.defineProperty(this, 'response', { writable: true })
        Object.defineProperty(this, 'responseText', { writable: true })
        // @ts-expect-error xx
        this.response = this.responseText = text
      } catch (error) {
        console.error('NouScript:', error)
      }
    })
    return xhrOpen.apply(this, [method, url])
  }
}
