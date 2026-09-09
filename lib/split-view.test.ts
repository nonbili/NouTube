import { beforeEach, describe, expect, it } from 'bun:test'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import {
  closePlayer,
  handleSplitBack,
  hidePlayer,
  isShortsUrl,
  isWatchUrl,
  openInPlayer,
  openInBrowse,
  setBrowseWebview,
  setPlayerWebview,
  showPlayer,
} from './split-view'

const fakePlayer = () => {
  const loaded: string[] = []
  return {
    loaded,
    loadUrl: (url: string) => loaded.push(url),
    executeJavaScript: () => Promise.resolve(''),
  }
}

describe('isWatchUrl', () => {
  it('matches watch pages on the regular site', () => {
    expect(isWatchUrl('https://m.youtube.com/watch?v=abc123')).toBe(true)
    expect(isWatchUrl('https://www.youtube.com/watch?v=abc123&list=PL1')).toBe(true)
  })

  it('leaves everything else with the browsing view', () => {
    expect(isWatchUrl('https://m.youtube.com/')).toBe(false)
    expect(isWatchUrl('https://m.youtube.com/shorts/abc123')).toBe(false)
    expect(isWatchUrl('https://m.youtube.com/@channel')).toBe(false)
    // YouTube Music is a player of its own.
    expect(isWatchUrl('https://music.youtube.com/watch?v=abc123')).toBe(false)
    expect(isWatchUrl('not a url')).toBe(false)
    expect(isWatchUrl('https://example.com/watch?v=abc123')).toBe(false)
    expect(isWatchUrl('https://m.youtube.com/watchlater')).toBe(false)
  })
})

describe('isShortsUrl', () => {
  it('detects the shorts feed', () => {
    expect(isShortsUrl('https://m.youtube.com/shorts/abc123')).toBe(true)
    expect(isShortsUrl('https://m.youtube.com/watch?v=abc123')).toBe(false)
  })
})

describe('handleSplitBack', () => {
  beforeEach(() => {
    settings$.separateWatchView.set(true)
    settings$.miniPlayer.set(false)
    closePlayer()
  })

  it('leaves the video for the browsing view instead of the previous video', () => {
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    expect(ui$.playerMode.get()).toBe('full')

    expect(handleSplitBack()).toBe(true)
    expect(ui$.playerMode.get()).toBe('hidden')
    // The player stays loaded so it keeps playing and can be reopened.
    expect(ui$.playerUrl.get()).toBe('https://m.youtube.com/watch?v=abc123')
  })

  it('shrinks into the mini player when that is on', () => {
    settings$.miniPlayer.set(true)
    openInPlayer('https://m.youtube.com/watch?v=abc123')

    expect(handleSplitBack()).toBe(true)
    expect(ui$.playerMode.get()).toBe('mini')
    expect(ui$.playerUrl.get()).toBe('https://m.youtube.com/watch?v=abc123')
  })

  it('leaves the press alone once the browsing view is in front', () => {
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    hidePlayer()
    expect(handleSplitBack()).toBe(false)
  })

  it('does nothing while the split is off', () => {
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    settings$.separateWatchView.set(false)
    expect(handleSplitBack()).toBe(false)
  })
})

describe('showPlayer', () => {
  beforeEach(() => closePlayer())

  it('needs a video to show', () => {
    showPlayer()
    expect(ui$.playerMode.get()).toBe('hidden')
  })

  it('brings the mini player back up without reloading it', () => {
    settings$.miniPlayer.set(true)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    hidePlayer()
    showPlayer()
    expect(ui$.playerMode.get()).toBe('full')
    expect(ui$.playerUrl.get()).toBe('https://m.youtube.com/watch?v=abc123')
  })
})

describe('closePlayer', () => {
  it('tears the player down for good', () => {
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    closePlayer()
    expect(ui$.playerUrl.get()).toBe('')
    expect(ui$.playerMode.get()).toBe('hidden')
  })
})


describe('openInPlayer', () => {
  beforeEach(() => {
    settings$.separateWatchView.set(true)
    settings$.miniPlayer.set(true)
    setPlayerWebview(null)
    closePlayer()
  })

  it('leaves the mini player alone when the queue advances on its own', () => {
    openInPlayer('https://m.youtube.com/watch?v=first12345')
    hidePlayer()
    expect(ui$.playerMode.get()).toBe('mini')

    openInPlayer('https://m.youtube.com/watch?v=second1234', { keepMode: true })
    expect(ui$.playerMode.get()).toBe('mini')
    expect(ui$.playerUrl.get()).toBe('https://m.youtube.com/watch?v=second1234')
  })

  it('opens full when the user asked for the video', () => {
    openInPlayer('https://m.youtube.com/watch?v=first12345')
    hidePlayer()
    openInPlayer('https://m.youtube.com/watch?v=second1234')
    expect(ui$.playerMode.get()).toBe('full')
  })

  it('hands over a video asked for before the webview attached', () => {
    const player = fakePlayer()
    openInPlayer('https://m.youtube.com/watch?v=early12345')
    expect(player.loaded).toEqual([])

    setPlayerWebview(player)
    expect(player.loaded).toEqual(['https://m.youtube.com/watch?v=early12345'])
  })

  it('empties the kept-warm webview when the video is closed', () => {
    const player = fakePlayer()
    setPlayerWebview(player)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    closePlayer()
    expect(player.loaded.at(-1)).toBe('about:blank')
  })
})


describe('openInBrowse', () => {
  beforeEach(() => {
    closePlayer()
    settings$.separateWatchView.set(true)
    settings$.miniPlayer.set(true)
    ui$.browsePageUrl.set('https://m.youtube.com/')
  })

  it('returns home without loading either webview again', () => {
    const browse = fakePlayer()
    const player = fakePlayer()
    setBrowseWebview(browse)
    setPlayerWebview(player)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    const playerLoads = [...player.loaded]

    openInBrowse('https://m.youtube.com')

    expect(browse.loaded).toEqual([])
    expect(player.loaded).toEqual(playerLoads)
    expect(ui$.playerMode.get()).toBe('mini')
    expect(ui$.webview.peek()).toBe(browse)
  })

  it('loads a different browse destination while retaining the player', () => {
    const browse = fakePlayer()
    setBrowseWebview(browse)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    openInBrowse('https://m.youtube.com/@channel')
    expect(browse.loaded).toEqual(['https://m.youtube.com/@channel'])
    expect(ui$.playerUrl.get()).toBe('https://m.youtube.com/watch?v=abc123')
  })
})
