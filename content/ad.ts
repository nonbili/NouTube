import { transformPlayerResponse } from '@/lib/ad'

export function blockAds() {
  const winFetch = fetch
  // @ts-expect-error xx
  window.fetch = async (...args) => {
    const request = args[0]
    const url = request instanceof Request ? request.url : request.toString()
    if (url.includes('youtubei/v1/player')) {
      try {
        const res = await winFetch(...args)
        if (!res.ok) {
          return res
        }
        const text = await res.text()
        return new Response(transformPlayerResponse(text), {
          status: res.status,
          headers: res.headers,
        })
      } catch (error) {
        console.error('NouScript:', error)
        return winFetch(...args)
      }
    }
    return winFetch(...args)
  }

  // https://stackoverflow.com/a/78369686
  const xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    url = url.toString()
    this.addEventListener('readystatechange', function () {
      if (url.includes('youtubei/v1/player') && this.readyState === 4) {
        const text = transformPlayerResponse(this.responseText)
        Object.defineProperty(this, 'response', { writable: true })
        Object.defineProperty(this, 'responseText', { writable: true })
        // @ts-expect-error xx
        this.response = this.responseText = text
      }
    })
    return xhrOpen.apply(this, [method, url])
  }
}
