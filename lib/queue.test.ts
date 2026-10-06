import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { queue$ } from '@/states/queue'
import { newBookmark } from '@/states/bookmarks'
import { getNextQueueUrl, trackQueueEnded } from './queue'

const first = 'https://m.youtube.com/watch?v=YE7VzlLtp-4'
const second = 'https://m.youtube.com/watch?v=aqz-KE-bpKQ'

describe('getNextQueueUrl for media Next', () => {
  beforeEach(() => {
    queue$.bookmarks.set([newBookmark({ url: first }), newBookmark({ url: second })])
    queue$.lastPlayedUrl.set('')
    queue$.lastPlayedEnded.set(false)
  })

  afterEach(() => {
    queue$.bookmarks.set([])
    queue$.lastPlayedUrl.set('')
    queue$.lastPlayedEnded.set(false)
  })

  it('starts the manual queue when the current video belongs to another playlist', () => {
    expect(getNextQueueUrl('https://m.youtube.com/watch?v=h_D3VFfhvs4&list=RDh_D3VFfhvs4')).toBe(first)
  })

  it('advances within the queue even when the playing URL has playlist parameters', () => {
    expect(getNextQueueUrl(`${first}&list=PLexample&index=1`)).toBe(second)
  })

  it('resumes the queue after an unrelated video', () => {
    queue$.markEnded(first)
    expect(getNextQueueUrl('https://m.youtube.com/watch?v=h_D3VFfhvs4')).toBe(second)
  })

  it('leaves the queue once its last video was skipped', () => {
    queue$.markPlaying(second)
    trackQueueEnded(second)
    expect(getNextQueueUrl('https://music.youtube.com/watch?v=h_D3VFfhvs4&list=RDAMVMh_D3VFfhvs4')).toBeUndefined()
  })

  it('allows the player fallback when the queue is exhausted or empty', () => {
    expect(getNextQueueUrl(second)).toBeUndefined()
    queue$.bookmarks.set([])
    expect(getNextQueueUrl(first)).toBeUndefined()
  })
})
