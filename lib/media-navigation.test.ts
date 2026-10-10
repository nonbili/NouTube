import { afterEach, beforeAll, describe, expect, it } from 'bun:test'

const names = ['window', 'document', 'location', 'screen'] as const
const globals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
const restore = () => {
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}

function browser(layout: string, ids: string[], playingId: string) {
  const messages: unknown[] = []
  const navigations: string[] = []
  const calls: string[] = []
  const player = {
    getVideoData: () => ({ video_id: playingId }),
    getVideoUrl: () => `https://m.youtube.com/watch?v=${playingId}`,
    getWatchNextResponse: () => ({ contents: { [layout]: { playlist: { playlist: {
      playlistId: 'PL1',
      contents: ids.map((videoId) => ({ playlistPanelVideoRenderer: { videoId, selected: videoId === playingId } })),
    } } } } }),
    nextVideo: () => calls.push('next'),
    previousVideo: () => calls.push('previous'),
    seekTo: () => calls.push('seek'),
  }
  const location = new URL(`https://m.youtube.com/watch?v=${playingId}&list=PL1`)
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
  return { calls, messages, navigations }
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
  }
})
