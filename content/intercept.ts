import {
  RE_INTERCEPT,
  filterListResponse,
  filterPlayerResponse,
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerResponse,
  transformReelResponse,
  transformSearchResponse,
} from '@/lib/intercept'

const adsBlocked = () => window.NouTube?.getSettings?.()?.blockAds !== false

// The embedded player response gets the same treatment as a fetched one below.
const playerOptions = () => ({
  showOriginalVideoTitle: Boolean(window.NouTube?.getSettings?.()?.showOriginalVideoTitle),
  blockAds: adsBlocked(),
})

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
        filterListResponse(value, blocklist, { blockAds: adsBlocked(), hideShorts: window.NouTube?.shortsHidden })
      } catch (error) {
        console.error('NouScript initialData:', error)
      }
      initialData = value
    },
    configurable: true,
  })

  // The watch page embeds its first player response as well. Left alone, its ad
  // placements reach the player, which then goes after ads the native side
  // blocks. Filtered on the way in, and once more in case this script landed
  // after the page had already set it.
  const filterInitialPlayerResponse = (value: any) => {
    try {
      if (value && typeof value === 'object') {
        filterPlayerResponse(value, playerOptions())
      }
    } catch (error) {
      console.error('NouScript initialPlayerResponse:', error)
    }
    return value
  }
  let initialPlayerResponse = filterInitialPlayerResponse((window as any).ytInitialPlayerResponse)
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    get() {
      return initialPlayerResponse
    },
    set(value) {
      initialPlayerResponse = filterInitialPlayerResponse(value)
    },
    configurable: true,
  })

  // The first batch of the Shorts feed is server-rendered too, as a JSON string
  // the page parses itself.
  let initialReelSequence = (window as any).ytInitialReelWatchSequenceResponse
  Object.defineProperty(window, 'ytInitialReelWatchSequenceResponse', {
    get() {
      return initialReelSequence
    },
    set(value) {
      try {
        const blocklist = window.NouTube?.getBlocklist?.()
        const options = { blockAds: adsBlocked() }
        if (typeof value === 'string') {
          value = transformReelResponse(value, blocklist, options)
        } else {
          filterListResponse(value, blocklist, options)
        }
      } catch (error) {
        console.error('NouScript initialReelSequence:', error)
      }
      initialReelSequence = value
    },
    configurable: true,
  })

  const winFetch = fetch
  // ts-ignore rather than ts-expect-error: react-native's global fetch typing
  // makes this assignment an error in the app's program but not in the
  // extension's, where an unused expect-error would itself fail the build.
  // @ts-ignore
  window.fetch = async (...args) => {
    const request = args[0]
    const url = request instanceof Request ? request.url : request.toString()
    let res = await winFetch(...args)
    // Relative to the page, as fetch itself resolves it: without a base a relative
    // url throws here and turns a response that arrived fine into a rejection.
    const match = new URL(url, location.origin).pathname.match(RE_INTERCEPT)
    const blocklist = window.NouTube?.getBlocklist?.()
    const settings = window.NouTube?.getSettings?.()
    const options = {
      showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle),
      blockAds: settings?.blockAds !== false,
      hideShorts: window.NouTube?.shortsHidden,
    }
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
          reel: (text: string, blocklist?: any) => transformReelResponse(text, blocklist, options),
          search: (text: string, _blocklist?: any) => transformSearchResponse(text, blocklist, options),
        }[match[1]] || ((text: string, blocklist?: any) => transformPlayerResponse(text, blocklist, options))
      return new Response(fn(text, blocklist), responseInit)
    } catch (error) {
      console.error('NouScript:', error)
    }
    return new Response(text, responseInit)
  }

  // Filter on first read, not in a ready-state listener: the site's listener
  // may have been registered before open(), and JSON XHRs have no responseText.
  const responseGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response')!.get!
  const textGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')!.get!
  const xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (...args: any[]) {
    const url = args[1].toString()
    const match = new URL(url, location.origin).pathname.match(RE_INTERCEPT)
    let cached = false
    let filteredText: string
    let filteredJson: any
    const read = (asText: boolean) => {
      const original = () => (asText ? textGetter : responseGetter).call(this)
      if (!match || this.readyState !== 4 || this.status !== 200 ||
          (this.responseType !== '' && this.responseType !== 'text' && this.responseType !== 'json')) {
        return original()
      }
      // Preserve the native InvalidStateError for responseText on JSON XHRs.
      if (asText && this.responseType === 'json') return original()
      if (cached) return this.responseType === 'json' ? filteredJson : filteredText
      const blocklist = window.NouTube?.getBlocklist?.()
      const settings = window.NouTube?.getSettings?.()
      const options = {
        showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle),
        blockAds: settings?.blockAds !== false,
        hideShorts: window.NouTube?.shortsHidden,
      }
      try {
        const fn =
          {
            browse: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
            get_watch: (text: string) => transformGetWatchResponse(text, options),
            next: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
            reel: (text: string, blocklist?: any) => transformReelResponse(text, blocklist, options),
            search: (text: string, _blocklist?: any) => transformSearchResponse(text, blocklist, options),
          }[match[1]] || ((text: string, blocklist?: any) => transformPlayerResponse(text, blocklist, options))
        const text = this.responseType === 'json' ? JSON.stringify(responseGetter.call(this)) : textGetter.call(this)
        filteredText = fn(text, blocklist)
        if (this.responseType === 'json') filteredJson = JSON.parse(filteredText)
        cached = true
        return this.responseType === 'json' ? filteredJson : filteredText
      } catch (error) {
        console.error('NouScript:', error)
        // A malformed/changed payload should pass through once, not be parsed
        // and logged again on every property read.
        if (this.responseType === 'json') filteredJson = responseGetter.call(this)
        else filteredText = textGetter.call(this)
        cached = true
      }
      return this.responseType === 'json' ? filteredJson : filteredText
    }
    Object.defineProperties(this, {
      response: { configurable: true, get: () => read(false) },
      responseText: { configurable: true, get: () => read(true) },
    })
    // Preserve async and optional authentication arguments, including sync XHR.
    return xhrOpen.apply(this, args as Parameters<typeof xhrOpen>)
  }
}
