import { describe, expect, test } from 'bun:test'
import { parseHTML } from 'linkedom'
import { attachPlayerGestureListeners, isPlayerGesturesSupported } from './player-gestures'

function createTouchEvent(
  EventCtor: typeof Event,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  target: Element,
  touches: Array<{ clientX: number; clientY: number }>,
  changedTouches = touches,
) {
  const event = new EventCtor(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent
  Object.defineProperty(event, 'target', { value: target })
  Object.defineProperty(event, 'touches', { value: touches })
  Object.defineProperty(event, 'changedTouches', { value: changedTouches })
  return event
}

function setupDom(options: {
  url?: string
  fullscreen?: boolean
  hasFullscreenButton?: boolean
  extraHtml?: string
  innerHeight?: number
} = {}) {
  const {
    url = 'https://m.youtube.com/watch?v=abcdefghijk',
    fullscreen = false,
    hasFullscreenButton = true,
    extraHtml = '',
    innerHeight = 800,
  } = options

  const buttonHtml = hasFullscreenButton ? '<button class="fullscreen-icon">FS</button>' : ''
  const html = `
    <html>
      <body>
        <div id="player-container-id">
          <div id="player-control-container">${buttonHtml}</div>
          <div id="movie_player">
            <video></video>
            <div class="ytPlayerProgressBarHost"></div>
          </div>
          ${extraHtml}
        </div>
      </body>
    </html>
  `
  const { document, window } = parseHTML(html)
  const parsedUrl = new URL(url)
  Object.defineProperty(document, 'location', { value: parsedUrl, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })

  const playerContainer = document.getElementById('player-container-id')!
  let fsClicks = 0
  let requestFullscreenCalls = 0
  let exitFullscreenCalls = 0

  const fsButton = document.querySelector<HTMLButtonElement>('.fullscreen-icon')
  fsButton?.addEventListener('click', () => {
    fsClicks += 1
  })
  playerContainer.requestFullscreen = async () => {
    requestFullscreenCalls += 1
  }

  Object.defineProperty(document, 'fullscreenElement', {
    value: fullscreen ? playerContainer : null,
    configurable: true,
  })
  document.exitFullscreen = async () => {
    exitFullscreenCalls += 1
  }

  const detach = attachPlayerGestureListeners(document, window as unknown as Window)

  return {
    document,
    window: window as unknown as Window,
    playerContainer,
    getFsClicks: () => fsClicks,
    getRequestFullscreenCalls: () => requestFullscreenCalls,
    getExitFullscreenCalls: () => exitFullscreenCalls,
    detach,
  }
}

function swipe(
  document: Document,
  target: Element,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const EventCtor = (document.defaultView as unknown as { Event: typeof Event }).Event
  const start = createTouchEvent(EventCtor, 'touchstart', target, [{ clientX: from.x, clientY: from.y }])
  target.dispatchEvent(start)
  const move = createTouchEvent(EventCtor, 'touchmove', target, [{ clientX: to.x, clientY: to.y }])
  target.dispatchEvent(move)
  const end = createTouchEvent(EventCtor, 'touchend', target, [], [{ clientX: to.x, clientY: to.y }])
  target.dispatchEvent(end)
  return { start, move, end }
}

describe('player gestures', () => {
  test('swiping up on the watch player enters fullscreen and marks intent', () => {
    const { document, window, getFsClicks, detach } = setupDom()
    const video = document.querySelector('video')!

    const { move } = swipe(document, video, { x: 200, y: 200 }, { x: 205, y: 120 })

    expect(move.defaultPrevented).toBe(true)
    expect(getFsClicks()).toBe(1)
    expect(typeof window.NouTubeFsIntent).toBe('number')
    expect(window.NouTubeFsIntent).toBeGreaterThan(0)
    detach()
  })

  test('falls back to requestFullscreen when .fullscreen-icon is absent', () => {
    const { document, getRequestFullscreenCalls, detach } = setupDom({ hasFullscreenButton: false })
    const video = document.querySelector('video')!

    swipe(document, video, { x: 200, y: 200 }, { x: 200, y: 120 })

    expect(getRequestFullscreenCalls()).toBe(1)
    detach()
  })

  test('swiping down in fullscreen exits fullscreen', () => {
    const { document, getExitFullscreenCalls, detach } = setupDom({ fullscreen: true })
    const video = document.querySelector('video')!

    const { move } = swipe(document, video, { x: 200, y: 150 }, { x: 205, y: 240 })

    expect(move.defaultPrevented).toBe(true)
    expect(getExitFullscreenCalls()).toBe(1)
    detach()
  })

  test('does not trigger on opposite directions, short swipes, or horizontal swipes', () => {
    const normal = setupDom()
    const normalVideo = normal.document.querySelector('video')!
    swipe(normal.document, normalVideo, { x: 200, y: 120 }, { x: 200, y: 220 }) // swipe down in normal
    const shortUp = swipe(normal.document, normalVideo, { x: 200, y: 200 }, { x: 200, y: 170 }) // short swipe up
    expect(shortUp.move.defaultPrevented).toBe(true)
    swipe(normal.document, normalVideo, { x: 200, y: 200 }, { x: 300, y: 130 }) // mostly horizontal
    expect(normal.getFsClicks()).toBe(0)
    normal.detach()

    const fs = setupDom({ fullscreen: true })
    const fsVideo = fs.document.querySelector('video')!
    swipe(fs.document, fsVideo, { x: 200, y: 240 }, { x: 200, y: 140 }) // swipe up in fullscreen
    swipe(fs.document, fsVideo, { x: 200, y: 150 }, { x: 200, y: 180 }) // short swipe down
    expect(fs.getExitFullscreenCalls()).toBe(0)
    fs.detach()
  })

  test('ignores touches on progress bars, buttons, bottom sheets, and Shorts', () => {
    const { document, getFsClicks, detach } = setupDom({
      extraHtml:
        '<div class="ytChapteredProgressBarHost"><span class="chapter-fill"></span></div>' +
        '<ytm-bottom-sheet-renderer><div class="sheet-body"></div></ytm-bottom-sheet-renderer>',
    })

    swipe(document, document.querySelector('.ytPlayerProgressBarHost')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    const chaptered = swipe(document, document.querySelector('.chapter-fill')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    expect(chaptered.move.defaultPrevented).toBe(false)
    swipe(document, document.querySelector('.fullscreen-icon')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    swipe(document, document.querySelector('.sheet-body')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    expect(getFsClicks()).toBe(0)
    detach()

    const shorts = setupDom({ url: 'https://m.youtube.com/shorts/abcdefghijk' })
    swipe(shorts.document, shorts.document.querySelector('video')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    expect(shorts.getFsClicks()).toBe(0)
    shorts.detach()

    const shortsFs = setupDom({ url: 'https://m.youtube.com/shorts/abcdefghijk', fullscreen: true })
    swipe(shortsFs.document, shortsFs.document.querySelector('video')!, { x: 200, y: 150 }, { x: 200, y: 240 })
    expect(shortsFs.getExitFullscreenCalls()).toBe(0)
    shortsFs.detach()
  })

  test('ignores gestures when locked, in mini player, on YouTube Music, or near screen edges', () => {
    const locked = setupDom({
      fullscreen: true,
      extraHtml: '<div id="_nou_lock_overlay"></div>',
    })
    const lockedSwipe = swipe(locked.document, locked.document.querySelector('video')!, { x: 200, y: 150 }, { x: 200, y: 240 })
    expect(lockedSwipe.move.defaultPrevented).toBe(false)
    expect(locked.getExitFullscreenCalls()).toBe(0)
    locked.detach()

    const mini = setupDom()
    mini.document.documentElement.classList.add('_nou_native_mini')
    swipe(mini.document, mini.document.querySelector('video')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    expect(mini.getFsClicks()).toBe(0)
    mini.detach()

    const music = setupDom({ url: 'https://music.youtube.com/watch?v=abcdefghijk' })
    swipe(music.document, music.document.querySelector('video')!, { x: 200, y: 200 }, { x: 200, y: 120 })
    expect(music.getFsClicks()).toBe(0)
    music.detach()

    const edge = setupDom({ fullscreen: true, innerHeight: 800 })
    swipe(edge.document, edge.document.querySelector('video')!, { x: 200, y: 10 }, { x: 200, y: 120 })
    expect(edge.getExitFullscreenCalls()).toBe(0)
    edge.detach()
  })

  test('cancels gesture on multi-touch', () => {
    const { document, getFsClicks, detach } = setupDom()
    const video = document.querySelector('video')!
    const EventCtor = (document.defaultView as unknown as { Event: typeof Event }).Event

    video.dispatchEvent(createTouchEvent(EventCtor, 'touchstart', video, [{ clientX: 200, clientY: 200 }]))
    video.dispatchEvent(
      createTouchEvent(EventCtor, 'touchstart', video, [
        { clientX: 200, clientY: 200 },
        { clientX: 240, clientY: 200 },
      ]),
    )
    video.dispatchEvent(createTouchEvent(EventCtor, 'touchend', video, [], [{ clientX: 200, clientY: 120 }]))

    expect(getFsClicks()).toBe(0)
    detach()
  })

  test('discards gesture if watch URL or player changes mid-swipe', () => {
    const { document, playerContainer, getFsClicks, getRequestFullscreenCalls, detach } = setupDom()
    const video = document.querySelector('video')!
    const EventCtor = (document.defaultView as unknown as { Event: typeof Event }).Event

    video.dispatchEvent(createTouchEvent(EventCtor, 'touchstart', video, [{ clientX: 200, clientY: 200 }]))
    Object.defineProperty(document, 'location', {
      value: new URL('https://m.youtube.com/watch?v=anothervideo'),
      configurable: true,
    })
    video.dispatchEvent(createTouchEvent(EventCtor, 'touchend', video, [], [{ clientX: 200, clientY: 120 }]))
    expect(getFsClicks()).toBe(0)
    expect(getRequestFullscreenCalls()).toBe(0)

    Object.defineProperty(document, 'location', {
      value: new URL('https://m.youtube.com/watch?v=abcdefghijk'),
      configurable: true,
    })
    const overlay = document.getElementById('player-control-container')!
    overlay.dispatchEvent(createTouchEvent(EventCtor, 'touchstart', overlay, [{ clientX: 200, clientY: 200 }]))
    document.getElementById('movie_player')!.remove()
    overlay.dispatchEvent(createTouchEvent(EventCtor, 'touchend', overlay, [], [{ clientX: 200, clientY: 120 }]))
    expect(getFsClicks()).toBe(0)
    expect(getRequestFullscreenCalls()).toBe(0)

    video.dispatchEvent(createTouchEvent(EventCtor, 'touchstart', video, [{ clientX: 200, clientY: 200 }]))
    playerContainer.remove()
    document.body.dispatchEvent(
      createTouchEvent(EventCtor, 'touchend', document.body, [], [{ clientX: 200, clientY: 120 }]),
    )
    expect(getFsClicks()).toBe(0)
    expect(getRequestFullscreenCalls()).toBe(0)
    detach()
  })

  test('catches fullscreen API rejections and clears NouTubeFsIntent', async () => {
    const { document, window, playerContainer, detach } = setupDom({ hasFullscreenButton: false })
    playerContainer.requestFullscreen = async () => {
      throw new Error('denied')
    }
    const video = document.querySelector('video')!
    swipe(document, video, { x: 200, y: 200 }, { x: 200, y: 120 })
    await Promise.resolve()
    expect(window.NouTubeFsIntent).toBe(0)
    detach()
  })

  test('clears NouTubeFsIntent when button click does not enter fullscreen', async () => {
    const { document, window, detach } = setupDom()
    document.querySelector('.fullscreen-icon')!.addEventListener(
      'click',
      () => {
        window.NouTubeFsIntent = (window.NouTubeFsIntent || 0) + 5
      },
      true,
    )
    const video = document.querySelector('video')!
    swipe(document, video, { x: 200, y: 200 }, { x: 200, y: 120 })
    expect(window.NouTubeFsIntent).toBeGreaterThan(0)
    await new Promise((resolve) => setTimeout(resolve, 550))
    expect(window.NouTubeFsIntent).toBe(0)
    detach()
  })

  test('checks iOS fullscreenEnabled before isAndroid', () => {
    expect(
      isPlayerGesturesSupported(
        { NouTubeIOS: true, isAndroid: true } as unknown as Window,
        { fullscreenEnabled: false } as Document,
      ),
    ).toBe(false)
    expect(
      isPlayerGesturesSupported(
        { NouTubeIOS: true, isAndroid: true } as unknown as Window,
        { fullscreenEnabled: true } as Document,
      ),
    ).toBe(true)
    expect(
      isPlayerGesturesSupported(
        { isAndroid: true } as unknown as Window,
        { fullscreenEnabled: false } as Document,
      ),
    ).toBe(true)
  })
})
