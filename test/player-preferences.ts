// A fresh browser context keeps content-script globals isolated from other tests.
import { parseHTML } from 'linkedom'

const mode = process.argv[2]
const { window, document } = parseHTML('<html><body><div id="movie_player"><div class="ytp-progress-list"></div></div></body></html>')
Object.defineProperty(document, 'location', { value: new URL('https://www.youtube.com/watch?v=abcdefghijk') })
const storage = new Map([['nou:settings', JSON.stringify({ sponsorBlock: true, playbackRate: 1.5, playbackQuality: 'hd720' })]])
Object.assign(globalThis, {
  window, document, HTMLVideoElement: window.HTMLVideoElement,
  screen: { orientation: new EventTarget() },
  getComputedStyle: () => ({ position: 'static' }),
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
})
const bar = document.querySelector('.ytp-progress-list')!
Object.defineProperty(bar, 'offsetWidth', { value: 400 })
const rates: number[] = []
const qualities: string[] = []
const handlers: Record<string, (state: number) => Promise<void>> = {}
const el = Object.assign(document.getElementById('movie_player')!, {
  getPlayerState: () => -1,
  getPlayerResponse: () => ({ videoDetails: { videoId: 'abcdefghijk', title: 'Example', lengthSeconds: '120' } }),
  getVideoUrl: () => document.location.href,
  getCurrentTime: () => 0,
  getAvailablePlaybackRates: () => [1, 1.5, 2],
  setPlaybackRate: (rate: number) => rates.push(rate),
  setPlaybackQualityRange: (quality: string) => qualities.push(quality),
  unMute() {},
  addEventListener(name: string, handler: (state: number) => Promise<void>) { handlers[name] = handler },
  removeEventListener(name: string) { delete handlers[name] },
})
let respond!: (response: Response) => void
let reject!: (error: Error) => void
globalThis.fetch = (() => new Promise<Response>((resolve, fail) => { respond = resolve; reject = fail })) as unknown as typeof fetch
const { handleVideoPlayer } = await import('../content/player')
handleVideoPlayer(el)
const pending = handlers.onStateChange(1)
const beforeResponse = { rates: [...rates], qualities: [...qualities] }
if (mode === 'stale') el.remove()
if (mode === 'failure') reject(new Error('SponsorBlock offline'))
else respond(Response.json([{ category: 'sponsor', actionType: 'skip', segment: [10, 20] }]))
await pending
const overlays = document.querySelectorAll('._nou_sb_segments').length
;(el as typeof el & { __nouPlayerCleanup(): void }).__nouPlayerCleanup()
console.log(JSON.stringify({ beforeResponse, rates, qualities, overlays }))
