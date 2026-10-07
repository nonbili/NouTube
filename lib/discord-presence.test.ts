import { describe, expect, it } from 'bun:test'
import {
  buildDiscordActivity,
  isDiscordActivityChanged,
  parseDiscordPlayback,
  type DiscordPlayback,
} from './discord-presence'

const playback: DiscordPlayback = {
  videoId: 'abc',
  url: 'https://www.youtube.com/watch?v=abc',
  title: 'A video',
  author: 'A channel',
  thumbnail: 'https://i.ytimg.com/vi/abc/hq.jpg',
  duration: 200,
  current: 50,
  playing: true,
  rate: 1,
  source: '',
}

describe('discord presence', () => {
  it('builds a watching activity with timestamps derived from the position', () => {
    expect(buildDiscordActivity(playback, 1_000_000, undefined, '')).toEqual({
      name: 'YouTube',
      type: 3,
      details: 'A video',
      state: 'A channel',
      timestamps: { start: 950_000, end: 1_150_000 },
    })
  })

  it('reports YouTube Music as listening', () => {
    const activity = buildDiscordActivity(
      { ...playback, url: 'https://music.youtube.com/watch?v=abc' },
      1_000_000,
      undefined,
      '',
    )
    expect(activity?.name).toBe('YouTube Music')
    expect(activity?.type).toBe(2)
  })

  it('hides paused playback', () => {
    expect(buildDiscordActivity({ ...playback, playing: false }, 1_000_000)).toBeUndefined()
    expect(buildDiscordActivity(undefined, 1_000_000)).toBeUndefined()
  })

  it('leaves the end off for a live stream', () => {
    expect(buildDiscordActivity({ ...playback, duration: 0 }, 1_000_000, undefined, '')?.timestamps).toEqual({
      start: 950_000,
    })
  })

  it('scales the progress bar by the playback speed', () => {
    const fast = { ...playback, rate: 2 }
    const sent = buildDiscordActivity(fast, 1_000_000, undefined, '')
    expect(sent?.timestamps).toEqual({ start: 975_000, end: 1_075_000 })
    // Ten seconds of wall clock is twenty of video: nothing to update.
    expect(isDiscordActivityChanged(sent, buildDiscordActivity({ ...fast, current: 70 }, 1_010_000))).toBe(false)
  })

  it('only attaches artwork when there is an application to own it', () => {
    expect(buildDiscordActivity(playback, 1_000_000, 'mp:external/x', '')?.assets).toBeUndefined()
    const activity = buildDiscordActivity(playback, 1_000_000, 'mp:external/x', '123')
    expect(activity?.application_id).toBe('123')
    expect(activity?.assets).toEqual({ large_image: 'mp:external/x', large_text: 'A video' })
  })

  it('clips long text and drops text Discord would reject', () => {
    const activity = buildDiscordActivity({ ...playback, title: 'x'.repeat(300), author: 'a' }, 1_000_000)
    expect(activity?.details?.length).toBe(128)
    expect(activity?.state).toBeUndefined()
  })

  it('ignores timestamp jitter but not a seek', () => {
    const sent = buildDiscordActivity(playback, 1_000_000)
    expect(isDiscordActivityChanged(sent, buildDiscordActivity({ ...playback, current: 55 }, 1_005_500))).toBe(false)
    expect(isDiscordActivityChanged(sent, buildDiscordActivity({ ...playback, current: 120 }, 1_005_000))).toBe(true)
    expect(isDiscordActivityChanged(sent, buildDiscordActivity({ ...playback, title: 'Next' }, 1_000_000))).toBe(true)
    expect(isDiscordActivityChanged(sent, undefined)).toBe(true)
    expect(isDiscordActivityChanged(undefined, undefined)).toBe(false)
  })

  it('rejects page payloads that cannot be shown', () => {
    expect(parseDiscordPlayback({ title: 'x', current: 1 })).toBeUndefined()
    expect(parseDiscordPlayback({ videoId: 'abc', title: 'x', current: 'nope' })).toBeUndefined()
    expect(parseDiscordPlayback({ videoId: 'abc', title: 'x', current: 3, duration: 'NaN', playing: 1 })).toEqual({
      videoId: 'abc',
      url: '',
      title: 'x',
      author: '',
      thumbnail: '',
      duration: 0,
      current: 3,
      playing: true,
      rate: 1,
      source: '',
    })
  })
})
