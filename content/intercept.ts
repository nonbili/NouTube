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
        filterListResponse(value, blocklist, { blockAds: adsBlocked() })
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
      const options = {
        showOriginalVideoTitle: Boolean(settings?.showOriginalVideoTitle),
        blockAds: settings?.blockAds !== false,
      }
      try {
        const fn =
          {
            browse: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
            get_watch: (text: string) => transformGetWatchResponse(text, options),
            next: (text: string, blocklist?: any) => transformBrowseResponse(text, blocklist, options),
            reel: (text: string, blocklist?: any) => transformReelResponse(text, blocklist, options),
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
