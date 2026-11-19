import { expect, test } from 'bun:test'
import { parseHTML } from 'linkedom'
import { installIOSFullscreen } from './ios-fullscreen'

async function withPlayer(run: (document: Document, location: URL, calls: unknown[][]) => Promise<void>) {
  const { window, document } = parseHTML(`<!doctype html><html><head></head><body>
    <div id="player-container-id">
      <div id="movie_player"><video class="html5-main-video"></video></div>
      <button class="fullscreen-icon">Fullscreen</button>
    </div>
  </body></html>`)
  const location = new URL('https://m.youtube.com/watch?v=example')
  const calls: unknown[][] = []
  const globals = {
    window: { NouTubeI: { setYouTubeFullscreen: (...args: unknown[]) => calls.push(args) }, addEventListener() {} },
    document,
    location,
    Element: window.Element,
    Event: window.Event,
    MutationObserver: window.MutationObserver,
  }
  const originalGlobals = Object.getOwnPropertyDescriptors(globalThis)
  const prototype = window.Element.prototype
  try {
    for (const [key, value] of Object.entries(globals)) {
      Object.defineProperty(globalThis, key, { configurable: true, value })
    }
    await run(document, location, calls)
  } finally {
    Reflect.deleteProperty(prototype, 'requestFullscreen')
    Reflect.deleteProperty(prototype, 'webkitRequestFullscreen')
    for (const key of Object.keys(globals)) {
      if (originalGlobals[key]) Object.defineProperty(globalThis, key, originalGlobals[key])
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test('fullscreen keeps the same video and uses its existing fullscreen control to exit', async () => {
  await withPlayer(async (document, _, calls) => {
    installIOSFullscreen()
    const video = document.querySelector('video')!
    const player = document.getElementById('player-container-id')!
    await video.requestFullscreen()
    expect(document.fullscreenElement).toBe(video)
    expect(player.classList.contains('_nou_ios_fullscreen')).toBe(true)
    expect(player.querySelector('video')).toBe(video)

    player.querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
    expect(document.fullscreenElement).toBeNull()
    expect(player.classList.contains('_nou_ios_fullscreen')).toBe(false)
    expect(calls).toEqual([[true, false], [false]])
  })
})

test('leaving the watch page and removing its player closes app fullscreen', async () => {
  await withPlayer(async (document, location, calls) => {
    installIOSFullscreen()
    const video = document.querySelector('video')!
    await video.requestFullscreen()
    location.pathname = '/feed/subscriptions'
    document.getElementById('player-container-id')!.remove()
    await Promise.resolve()
    expect(document.fullscreenEnabled).toBe(false)
    expect(document.fullscreenElement).toBeNull()
    expect(calls.at(-1)).toEqual([false])
  })
})
