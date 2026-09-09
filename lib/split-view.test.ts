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
  const scripts: string[] = []
  return {
    loaded,
    scripts,
    loadUrl: (url: string) => loaded.push(url),
    executeJavaScript: (script: string) => {
      scripts.push(script)
      return Promise.resolve('')
    },
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
    settings$.miniPlayer.set(true)
    closePlayer()
  })

  it('leaves the video for the browsing view instead of the previous video', () => {
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    expect(ui$.playerMode.get()).toBe('full')

    expect(handleSplitBack()).toBe(true)
    // Into the mini player, still loaded and still playing.
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
    settings$.miniPlayer.set(false)
    expect(handleSplitBack()).toBe(false)
  })
})

describe('hidePlayer', () => {
  beforeEach(() => {
    settings$.miniPlayer.set(true)
    closePlayer()
  })

  // The split and the mini player are one setting, so a loaded video always
  // has somewhere to go: it keeps playing in the corner rather than being
  // parked out of sight with no way back to it.
  it('keeps the video playing in the mini player', () => {
    const player = fakePlayer()
    setPlayerWebview(player)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    player.scripts.length = 0

    hidePlayer()

    expect(ui$.playerMode.get()).toBe('mini')
    expect(player.scripts.some((script) => script.includes('pause'))).toBe(false)
    expect(player.loaded).toEqual(['https://m.youtube.com/watch?v=abc123'])
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
    settings$.miniPlayer.set(true)
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
    settings$.miniPlayer.set(true)
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

describe('loading into a player whose native view is not up yet', () => {
  beforeEach(() => {
    settings$.miniPlayer.set(true)
    closePlayer()
    ui$.playerPageUrl.set('')
  })

  // Turning the split on while a video is open mounts the player webview and
  // hands it the video in the same commit, so the first loads reach the module
  // before the native view exists and come back rejected.
  const flakyPlayer = (failures: number) => {
    const loaded: string[] = []
    let remaining = failures
    return {
      loaded,
      loadUrl: (url: string) => {
        if (remaining > 0) {
          remaining--
          return Promise.reject(new Error('Unable to find the view with tag 1'))
        }
        loaded.push(url)
        return Promise.resolve()
      },
      executeJavaScript: () => Promise.resolve(''),
    }
  }

  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
  }

  it('retries until the view is there', async () => {
    const player = flakyPlayer(3)
    setPlayerWebview(player)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    expect(player.loaded).toEqual([])
    await settle()
    expect(player.loaded).toEqual(['https://m.youtube.com/watch?v=abc123'])
  })

  it('drops a retry for a video that has since been closed', async () => {
    const player = flakyPlayer(3)
    setPlayerWebview(player)
    openInPlayer('https://m.youtube.com/watch?v=abc123')
    closePlayer()
    await settle()
    expect(player.loaded).not.toContain('https://m.youtube.com/watch?v=abc123')
  })
})
