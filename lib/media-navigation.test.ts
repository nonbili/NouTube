import { afterEach, beforeAll, describe, expect, it } from 'bun:test'

const names = ['window', 'document', 'location', 'screen'] as const
const globals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
const restore = () => {
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}

function browser(layout: string, ids: string[], playingId: string, selectedId = playingId) {
  const messages: unknown[] = []
  const navigations: string[] = []
  const calls: string[] = []
  const loads: string[] = []
  const player = {
    getVideoData: () => ({ video_id: playingId }),
    getVideoUrl: () => `https://m.youtube.com/watch?v=${playingId}`,
    getWatchNextResponse: () => ({ contents: { [layout]: { playlist: { playlist: {
      playlistId: 'PL1',
      contents: ids.map((videoId) => ({ playlistPanelVideoRenderer: { videoId, selected: videoId === selectedId } })),
    } } } } }),
    nextVideo: () => calls.push('next'),
    previousVideo: () => calls.push('previous'),
    seekTo: () => calls.push('seek'),
  }
  const location = Object.assign(new URL(`https://m.youtube.com/watch?v=${playingId}&list=PL1`), {
    assign: (url: string) => loads.push(url),
  })
  const document = Object.assign(new EventTarget(), {
    location,
    getElementById: () => player,
    createElement: () => ({ href: '', style: {}, click() { navigations.push(this.href) }, remove() {} }),
    body: { appendChild() {} },
  })
  const window = Object.assign(new EventTarget(), {
    NouTubeI: { onMessage: (payload: string) => messages.push(JSON.parse(payload)) },
  })
  Object.assign(globalThis, { document, window, location, screen: { orientation: new EventTarget() } })
  return { calls, document, loads, messages, navigations }
}

let initNouTube: typeof import('../content/noutube').initNouTube
beforeAll(async () => {
  browser('singleColumnWatchNextResults', [], 'bbb')
  try { ({ initNouTube } = await import('../content/noutube')) } finally { restore() }
})
afterEach(restore)

describe('media navigation', () => {
  for (const layout of ['singleColumnWatchNextResults', 'twoColumnWatchNextResults']) {
    it(`bridges Next to the manual queue before the ${layout} playlist`, () => {
      const page = browser(layout, ['aaa', 'bbb', 'ccc'], 'bbb')
      initNouTube().next()
      expect(page.messages).toEqual([{ type: 'playback-next', data: { url: 'https://m.youtube.com/watch?v=bbb' } }])
      expect(page.navigations).toEqual([])
      expect(page.calls).toEqual([])
    })

    it(`follows ${layout} neighbors when the manual queue has no next entry`, () => {
      const page = browser(layout, ['aaa', 'bbb', 'ccc'], 'bbb')
      const controls = initNouTube()
      controls.skipToNext()
      controls.prev()
      expect(page.navigations).toEqual(['https://m.youtube.com/watch?v=ccc&list=PL1', 'https://m.youtube.com/watch?v=aaa&list=PL1'])
      expect(page.calls).toEqual([])
    })

    it(`does not escape either end of a ${layout} playlist`, () => {
      const page = browser(layout, ['bbb'], 'bbb')
      const controls = initNouTube()
      controls.skipToNext()
      controls.prev()
      expect(page.navigations).toEqual([])
      expect(page.calls).toEqual([])
    })

    it(`reloads to leave a ${layout} playlist that is about an earlier video`, () => {
      const page = browser(layout, ['aaa', 'bbb', 'ccc'], 'aaa', 'bbb')
      const controls = initNouTube()
      controls.skipToNext()
      controls.prev()
      expect(page.loads).toEqual(['/watch?v=bbb&list=PL1'])
      expect(page.navigations).toEqual([])
      expect(page.calls).toEqual([])
    })
  }

  it('leaves a playlist alone that the page was served with and has since left', () => {
    const page = browser('singleColumnWatchNextResults', [], 'bbb')
    const contents = ['aaa', 'bbb'].map((videoId) => ({
      playlistPanelVideoRenderer: { videoId, selected: videoId == 'bbb' },
    }))
    const playlist = { playlistId: 'PL1', contents }
    Object.assign(globalThis.window, {
      ytInitialData: { contents: { singleColumnWatchNextResults: { playlist: { playlist } } } },
    })
    const controls = initNouTube()
    controls.prev()
    expect(page.navigations).toEqual(['https://m.youtube.com/watch?v=aaa&list=PL1'])
    ;(globalThis as any).location.search = ''
    controls.prev()
    expect(page.navigations.length).toBe(1)
    expect(page.calls).toEqual(['seek', 'previous'])
  })

  it("offers the page's own next button to the manual queue first", () => {
    const page = browser('singleColumnWatchNextResults', [], 'bbb')
    const controls = initNouTube()
    const clicks: string[] = []
    const previous = { closest: () => undefined }
    const nextButton: any = { isConnected: true, getAttribute: () => 'false', click: () => clicks.push('next') }
    const middle = { querySelectorAll: () => [previous, nextButton] }
    nextButton.closest = (selector: string) => (selector == '.player-controls-middle' ? middle : nextButton)
    const press = () => {
      const event = new Event('click', { cancelable: true })
      Object.defineProperty(event, 'target', { value: nextButton })
      page.document.dispatchEvent(event)
      return event
    }

    expect(press().defaultPrevented).toBe(true)
    expect(page.messages).toEqual([{ type: 'playback-next', data: { url: 'https://m.youtube.com/watch?v=bbb' } }])
    expect(clicks).toEqual([])

    // The queue had nothing, so the press goes back to the button once.
    controls.skipToNext()
    expect(clicks).toEqual(['next'])
    expect(page.calls).toEqual([])
    controls.skipToNext()
    expect(clicks).toEqual(['next'])
    expect(page.calls).toEqual(['next'])
  })
})
