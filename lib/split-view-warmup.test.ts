import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

const globalNames = ['window', 'document', 'location', 'history', 'MutationObserver'] as const
const originalGlobals = new Map(globalNames.map((name) => [
  name, Object.getOwnPropertyDescriptor(globalThis, name),
]))

function restoreGlobals() {
  for (const name of globalNames) {
    const descriptor = originalGlobals.get(name)
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}

function browser(url: string, hasRoot = true) {
  const location = new URL(url)
  const media = { muted: false }
  const messages: { type: string; data?: { url: string } }[] = []
  let backCalls = 0
  let observerConnected = false
  const window = Object.assign(new EventTarget(), {
    NouTubeRole: 'player',
    NouTubePlayerWarmup: true,
    screen: { width: 393, height: 808 },
    NouTubeI: { onMessage: (payload: string) => messages.push(JSON.parse(payload)) },
  })
  const document = Object.assign(new EventTarget(), {
    location,
    documentElement: hasRoot ? {} : null,
    querySelectorAll: () => [media],
  })
  const navigate = (_data: unknown, _unused: string, url?: string | URL | null) => {
    if (url) location.href = new URL(url, location.href).href
  }
  const history = {
    pushState: navigate,
    replaceState: navigate,
    back: () => { backCalls++ },
  }
  class MutationObserver {
    observe() { observerConnected = true }
    disconnect() { observerConnected = false }
  }
  Object.assign(globalThis, { window, document, location, history, MutationObserver })
  return {
    window, document, location, history, media, messages,
    get backCalls() { return backCalls },
    get observerConnected() { return observerConnected },
  }
}

let content: typeof import('../content/split-view')

beforeAll(async () => {
  // content/utils reads the browser globals at import time.
  browser('https://m.youtube.com/')
  try {
    content = await import('../content/split-view')
  } finally {
    restoreGlobals()
  }
})

describe('player document warmup', () => {
  beforeEach(() => browser('https://m.youtube.com/'))
  afterEach(() => {
    content.setMuted(false)
    restoreGlobals()
  })

  const settleNavigation = () => new Promise((resolve) => setTimeout(resolve, 450))

  it('plays a fresh watch document despite a stale warmup prop', async () => {
    const page = browser('https://m.youtube.com/watch?v=first')
    content.installSplitView()

    expect(page.window.NouTubePlayerWarmup).toBe(false)
    expect(page.media.muted).toBe(false)
    expect(page.observerConnected).toBe(false)

    page.history.pushState(null, '', '/@channel')
    await settleNavigation()
    expect(page.messages).toEqual([
      { type: 'open-page', data: { url: 'https://m.youtube.com/@channel' } },
    ])
    expect(page.backCalls).toBe(1)
  })

  it('keeps the preloaded home muted without handing it to browsing', async () => {
    const page = browser('https://m.youtube.com/')
    content.installSplitView()
    page.window.dispatchEvent(new Event('yt-navigate-finish'))
    await settleNavigation()

    expect(page.media.muted).toBe(true)
    expect(page.observerConnected).toBe(true)
    expect(page.messages).toEqual([])
    expect(page.backCalls).toBe(0)
  })

  it('checks the actual URL when the document root arrives later', () => {
    const page = browser('https://m.youtube.com/', false)
    content.installSplitView()
    page.location.href = 'https://m.youtube.com/watch?v=early'
    page.document.documentElement = {}
    page.document.dispatchEvent(new Event('DOMContentLoaded'))

    expect(page.window.NouTubePlayerWarmup).toBe(false)
    expect(page.media.muted).toBe(false)
    expect(page.observerConnected).toBe(false)
  })

  it('ends warmup permanently after the page reaches watch itself', async () => {
    const page = browser('https://m.youtube.com/')
    content.installSplitView()
    page.history.pushState(null, '', '/watch?v=first')
    await settleNavigation()

    expect(page.window.NouTubePlayerWarmup).toBe(false)
    expect(page.media.muted).toBe(false)
    expect(page.observerConnected).toBe(false)

    page.history.pushState(null, '', '/')
    await settleNavigation()
    expect(page.messages).toEqual([
      { type: 'open-page', data: { url: 'https://m.youtube.com/' } },
    ])
  })
})
