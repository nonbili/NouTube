import {
  RE_INTERCEPT,
  filterListResponse,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerRequest,
  transformPlayerResponse,
  transformSearchResponse,
} from '@/lib/intercept'
import { isYTMusic } from './utils'

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
    let request = args[0]
    const url = request instanceof Request ? request.url : request.toString()
    const match = new URL(url, location.origin).pathname.match(RE_INTERCEPT)
    const settings = window.NouTube?.getSettings?.()
    const isMusic = (isYTMusic || location.host === 'music.youtube.com') && Boolean(settings?.ytMusicAudioOnly)

    if (match && isMusic && (match[1] === 'player' || match[1] === 'next')) {
      try {
        let init = args[1] || {}
        if (request instanceof Request) {
          const bodyText = await request.clone().text()
          const newBody = transformPlayerRequest(bodyText, true)
          if (newBody !== bodyText) {
            request = new Request(request, { body: newBody })
            args[0] = request
          }
        } else if (init.body && typeof init.body === 'string') {
          init = { ...init, body: transformPlayerRequest(init.body, true) }
          args[1] = init
        }
      } catch (e) {
        console.error('NouScript fetch request transform:', e)
      }
    }

    let res = await winFetch(...args)
    const blocklist = window.NouTube?.getBlocklist?.()
    const options = { showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle), isYTMusic: isMusic }
    if (res.status > 200 || !match) {
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
  const xhrSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    url = url.toString()
    ;(this as any)._nouUrl = url
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
      const isMusic = (isYTMusic || location.host === 'music.youtube.com') && Boolean(settings?.ytMusicAudioOnly)
      const options = { showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle), isYTMusic: isMusic }
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
    return xhrOpen.apply(this, [method, url, ...rest] as any)
  }

  XMLHttpRequest.prototype.send = function (body) {
    const url = (this as any)._nouUrl || ''
    const settings = window.NouTube?.getSettings?.()
    const isMusic = (isYTMusic || location.host === 'music.youtube.com') && Boolean(settings?.ytMusicAudioOnly)
    if (url && isMusic && typeof body === 'string') {
      const match = new URL(url, location.origin).pathname.match(RE_INTERCEPT)
      if (match && (match[1] === 'player' || match[1] === 'next')) {
        body = transformPlayerRequest(body, true)
      }
    }
    return xhrSend.apply(this, [body])
  }
}
