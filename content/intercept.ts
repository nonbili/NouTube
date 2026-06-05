import {
  RE_INTERCEPT,
  filterListResponse,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerResponse,
  transformSearchResponse,
} from '@/lib/intercept'

export function intercept() {
  // Intercept initial page data (server-rendered in script tags)
  let initialData = (window as any).ytInitialData
  Object.defineProperty(window, 'ytInitialData', {
    get() {
      return initialData
    },
    set(value) {
      try {
        const blocklist = window.NouTube?.getBlocklist?.()
        filterListResponse(value, blocklist)
      } catch (error) {
        console.error('NouScript initialData:', error)
      }
      initialData = value
    },
    configurable: true,
  })

  const winFetch = fetch
  // @ts-expect-error xx
  window.fetch = async (...args) => {
    const request = args[0]
    const url = request instanceof Request ? request.url : request.toString()
    let res = await winFetch(...args)
    const match = new URL(url).pathname.match(RE_INTERCEPT)
    const blocklist = window.NouTube?.getBlocklist?.()
    const settings = window.NouTube?.getSettings?.()
    const options = { showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle) }
    const hasBlocklist = Boolean(blocklist?.channels?.length || blocklist?.keywords?.length)
    if (
      res.status > 200 ||
      !match ||
      (match[1] == 'search' && !window.NouTube.shortsHidden && !hasBlocklist && !options.showOriginalVideoTitle)
    ) {
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
          browse: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
          get_watch: (text: string) => transformGetWatchResponse(text, options),
          next: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
          search: (text: string, _blocklist?: any) =>
            transformSearchResponse(text, blocklist, {
              hideShorts: window.NouTube.shortsHidden,
              ...options,
            }),
        }[match[1]] || ((text: string, blocklist?: any) => transformPlayerResponse(text, blocklist, options))
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
      const settings = window.NouTube?.getSettings?.()
      const options = { showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle) }
      const hasBlocklist = Boolean(blocklist?.channels?.length || blocklist?.keywords?.length)
      if (match[1] == 'search' && !window.NouTube.shortsHidden && !hasBlocklist && !options.showOriginalVideoTitle) {
        return
      }

      try {
        const fn =
          {
            browse: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
            get_watch: (text: string) => transformGetWatchResponse(text, options),
            next: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
            search: (text: string, _blocklist?: any) =>
              transformSearchResponse(text, blocklist, {
                hideShorts: window.NouTube.shortsHidden,
                ...options,
              }),
          }[match[1]] || ((text: string, blocklist?: any) => transformPlayerResponse(text, blocklist, options))
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
