import { describe, expect, it } from 'bun:test'
import { bindPlayerMedia, readPlayerProgress } from '../content/player-progress'

const video = () => new EventTarget() as HTMLVideoElement
const response = (id: string) => ({
  videoDetails: {
    videoId: id,
    title: `Title ${id}`,
    lengthSeconds: '300',
    thumbnail: { thumbnails: [{ url: 'https://example.com/thumb' }] },
  },
})

describe('player progress snapshots', () => {
  it('reads identity and URL from the supplied player', () => {
    const old = { getPlayerResponse: () => response('A'), getVideoUrl: () => 'https://www.youtube.com/watch?v=A' }
    const next = { getPlayerResponse: () => response('B'), getVideoUrl: () => 'https://www.youtube.com/watch?v=B' }
    expect(readPlayerProgress(old, 30)).toMatchObject({ videoId: 'A', url: old.getVideoUrl(), current: 30 })
    expect(readPlayerProgress(next, 5)).toMatchObject({ videoId: 'B', url: next.getVideoUrl(), current: 5 })
  })

  it('waits when the response still describes the previous video', () => {
    const player = { getPlayerResponse: () => response('A'), getVideoUrl: () => 'https://www.youtube.com/watch?v=B' }
    expect(readPlayerProgress(player, 30)).toBeUndefined()
    player.getPlayerResponse = () => response('B')
    expect(readPlayerProgress(player, 30)?.videoId).toBe('B')
  })

  it('accepts Music, Shorts and embedded player URLs', () => {
    for (const url of [
      'https://music.youtube.com/watch?v=A',
      'https://www.youtube.com/shorts/A',
      'https://www.youtube.com/embed/A',
    ]) {
      expect(readPlayerProgress({ getPlayerResponse: () => response('A'), getVideoUrl: () => url }, 0)?.videoId).toBe(
        'A',
      )
    }
  })
})

describe('player media lifecycle', () => {
  it('records after metadata arrives without another player state change', () => {
    const media = video()
    let ready = false
    const player = {
      getPlayerResponse: () => (ready ? response('A') : {}),
      getVideoUrl: () => 'https://www.youtube.com/watch?v=A',
    }
    const recorded: string[] = []
    const binding = bindPlayerMedia({
      getMedia: () => media,
      isCurrent: () => true,
      onProgress: () => {
        const progress = readPlayerProgress(player, 30)
        if (progress) recorded.push(progress.videoId)
      },
      onPlayState() {},
      onRateChange() {},
      cancelPending() {},
    })
    binding.sync()
    media.dispatchEvent(new Event('timeupdate'))
    expect(recorded).toEqual([])
    ready = true
    media.dispatchEvent(new Event('timeupdate'))
    expect(recorded).toEqual(['A'])
    binding.dispose()
  })

  it('records the replacement media and detaches the previous element', () => {
    const old = video(),
      next = video()
    let current = old
    const recorded: HTMLVideoElement[] = []
    const binding = bindPlayerMedia({
      getMedia: () => current,
      isCurrent: () => true,
      onProgress: () => recorded.push(current),
      onPlayState() {},
      onRateChange() {},
      cancelPending() {},
    })
    binding.sync()
    old.dispatchEvent(new Event('timeupdate'))
    current = next
    // Even an event delivered before the mutation observer runs is stale.
    old.dispatchEvent(new Event('timeupdate'))
    binding.sync()
    binding.sync()
    old.dispatchEvent(new Event('timeupdate'))
    next.dispatchEvent(new Event('timeupdate'))
    expect(recorded).toEqual([old, next])
    binding.dispose()
  })

  it('ignores callbacks from an inactive or disposed player', () => {
    const media = video()
    let active = true
    let progress = 0,
      playState = 0,
      rate = 0
    const binding = bindPlayerMedia({
      getMedia: () => media,
      isCurrent: () => active,
      onProgress: () => progress++,
      onPlayState: () => playState++,
      onRateChange: () => rate++,
      cancelPending() {},
    })
    binding.sync()
    active = false
    for (const type of ['timeupdate', 'play', 'pause', 'ratechange']) media.dispatchEvent(new Event(type))
    active = true
    binding.dispose()
    media.dispatchEvent(new Event('timeupdate'))
    binding.sync()
    media.dispatchEvent(new Event('timeupdate'))
    expect({ progress, playState, rate }).toEqual({ progress: 0, playState: 0, rate: 0 })
  })
})
