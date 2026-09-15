import { beforeEach, describe, expect, it } from 'bun:test'
import { history$, History } from './history'

const add = (videoId: string, extra: Record<string, unknown> = {}) =>
  history$.addHistory({
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: videoId,
    current: 10,
    duration: 600,
    ...extra,
  })

const addMusic = (videoId: string, extra: Record<string, unknown> = {}) =>
  add(videoId, { url: `https://music.youtube.com/watch?v=${videoId}`, ...extra })

describe('addHistory', () => {
  beforeEach(() => {
    history$.bookmarks.set([])
  })

  it('updates the newest entry in place', () => {
    add('a')
    add('a', { current: 42 })
    expect(history$.bookmarks.get().length).toBe(1)
    expect(history$.bookmarks[0].current.get()).toBe(42)
  })

  it('moves a rewatched video back to the top instead of duplicating it', () => {
    add('a')
    add('b')
    add('a', { current: 99 })
    const bookmarks = history$.bookmarks.get()
    expect(bookmarks.map((x) => x.videoId)).toEqual(['a', 'b'])
    expect(bookmarks[0].current).toBe(99)
  })

  it('keeps the id of the entry it moves', () => {
    add('a')
    const id = history$.bookmarks[0].id.get()
    add('b')
    add('a')
    expect(history$.bookmarks[0].id.get()).toBe(id)
  })

  it('keeps fields the new payload omits', () => {
    add('a', { thumbnail: 'https://i.ytimg.com/a.jpg' })
    add('b')
    add('a', { title: undefined })
    expect(history$.bookmarks[0].thumbnail.get()).toBe('https://i.ytimg.com/a.jpg')
    expect(history$.bookmarks[0].title.get()).toBe('a')
  })

  it('counts unique urls', () => {
    add('a')
    add('b')
    expect(history$.size()).toBe(2)
  })
})

describe('addHistory across homes', () => {
  beforeEach(() => {
    history$.bookmarks.set([])
  })

  it('keeps the same video watched on both homes as two entries', () => {
    add('a')
    addMusic('a')
    const bookmarks = history$.bookmarks.get()
    expect(bookmarks.length).toBe(2)
    expect(bookmarks.map((x) => x.url)).toEqual([
      'https://music.youtube.com/watch?v=a',
      'https://www.youtube.com/watch?v=a',
    ])
  })

  it('does not move the YouTube entry when the music one is updated', () => {
    add('a')
    addMusic('a')
    add('b')
    addMusic('a', { current: 55 })
    const bookmarks = history$.bookmarks.get()
    expect(bookmarks.map((x) => x.url)).toEqual([
      'https://music.youtube.com/watch?v=a',
      'https://www.youtube.com/watch?v=b',
      'https://www.youtube.com/watch?v=a',
    ])
    expect(bookmarks[0].current).toBe(55)
    expect(bookmarks[2].current).toBe(10)
  })
})

describe('restoreHistory', () => {
  beforeEach(() => {
    history$.bookmarks.set([])
  })

  const clear = (keep: (x: History) => boolean) => {
    const bookmarks = history$.bookmarks.get()
    const cleared = bookmarks.filter((x) => !keep(x))
    history$.bookmarks.set(bookmarks.filter(keep))
    return cleared
  }

  it('brings the cleared entries back in order', () => {
    add('a')
    add('b')
    const cleared = clear(() => false)
    history$.restoreHistory(cleared)
    expect(history$.bookmarks.get().map((x) => x.videoId)).toEqual(['b', 'a'])
  })

  it('keeps entries recorded during the undo window', () => {
    add('a')
    const cleared = clear(() => false)
    add('c')
    history$.restoreHistory(cleared)
    expect(history$.bookmarks.get().map((x) => x.videoId)).toEqual(['c', 'a'])
  })

  it('does not overwrite progress recorded after the clear', () => {
    add('a')
    const cleared = clear(() => false)
    add('a', { current: 300 })
    history$.restoreHistory(cleared)
    const bookmarks = history$.bookmarks.get()
    expect(bookmarks.length).toBe(1)
    expect(bookmarks[0].current).toBe(300)
  })

  it('leaves the other home entries alone', () => {
    add('a')
    addMusic('a')
    const cleared = clear((x) => x.url.includes('music.'))
    history$.restoreHistory(cleared)
    expect(history$.bookmarks.get().length).toBe(2)
  })
})
