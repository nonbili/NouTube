import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { intercept } from '../content/intercept'

it('filters XHR before early listeners read it, supports JSON and reuse, and preserves open arguments', () => {
  class FakeXHR {
    readyState = 0
    status = 200
    responseType = ''
    payload: any
    onreadystatechange?: () => void
    args: any[] = []
    get response() { return this.responseType === 'json' ? this.payload : JSON.stringify(this.payload) }
    get responseText() {
      if (this.responseType === 'json') throw new Error('InvalidStateError')
      return JSON.stringify(this.payload)
    }
    open(...args: any[]) { this.args = args; this.readyState = 1 }
    complete(payload: any) { this.payload = payload; this.readyState = 4; this.onreadystatechange?.() }
  }
  const globals = ['window', 'location', 'XMLHttpRequest'] as const
  const saved = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key))
  const originalFetch = globalThis.fetch
  const win: any = { NouTube: { getSettings: () => ({ blockAds: true }), shortsHidden: true } }
  try {
    Object.assign(globalThis, { window: win, location: { origin: 'https://m.youtube.com' }, XMLHttpRequest: FakeXHR })
    intercept()
    const short = { shortsLockupViewModel: { entityId: 'short' } }
    win.NouTube.shortsHidden = false
    win.ytInitialData = { contents: [short] }
    expect(win.ytInitialData.contents).toEqual([short])
    win.NouTube.shortsHidden = true
    win.ytInitialData = { contents: [short] }
    expect(win.ytInitialData.contents).toEqual([])
    const xhr = new FakeXHR()
    let observed: any
    xhr.onreadystatechange = () => { observed = xhr.response }
    xhr.open('POST', '/youtubei/v1/player', false, 'user', 'password')
    expect(xhr.args).toEqual(['POST', '/youtubei/v1/player', false, 'user', 'password'])
    xhr.complete({ adPlacements: [{}], videoDetails: { videoId: 'first' } })
    expect(JSON.parse(observed)).toEqual({ videoDetails: { videoId: 'first' } })
    expect(xhr.responseText).toBe(observed)

    xhr.open('POST', '/youtubei/v1/player')
    xhr.responseType = 'json'
    xhr.complete({ adSlots: [{}], videoDetails: { videoId: 'second' } })
    expect(observed).toEqual({ videoDetails: { videoId: 'second' } })
    expect(xhr.response).toBe(observed)
    expect(() => xhr.responseText).toThrow('InvalidStateError')

    xhr.open('GET', '/unrelated')
    xhr.complete({ adSlots: [{}], untouched: true })
    expect(observed).toEqual({ adSlots: [{}], untouched: true })

    win.NouTube.getSettings = () => ({ blockAds: false })
    xhr.open('POST', '/youtubei/v1/player')
    xhr.complete({ adPlacements: [{}] })
    expect(observed.adPlacements).toHaveLength(1)
  } finally {
    globals.forEach((key, i) => {
      if (saved[i]) Object.defineProperty(globalThis, key, saved[i]!)
      else delete (globalThis as any)[key]
    })
    globalThis.fetch = originalFetch
  }
})

it('seeds the saved Shorts preference before content initialization on each shell', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  const app = read('../components/page/MainPageContent.tsx')
  expect(app).toContain('window.NouTubeHideShorts = ${settings$.hideShorts.get()')
  expect(app).toContain('window.NouTubeHideShorts = ${hideShorts')
  expect(read('../content/noutube.ts')).toContain('shortsHidden: window.NouTubeHideShorts !== false')
  expect(read('../extension/lib/page/prelude.ts')).toContain('window.NouTubeHideShorts = cache.hideShorts !== false')
})
