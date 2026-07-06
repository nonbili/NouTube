import { describe, expect, it } from 'bun:test'
import { getPageType } from './page-type'
import { removeTrackingParams } from './tracking-url'

describe('getPageType', () => {
  it('does not mark youtube results pages as starrable', () => {
    expect(getPageType('https://m.youtube.com/results?search_query=test')).toEqual({
      home: 'yt',
      type: 'results',
      canStar: false,
    })
  })

  it('keeps handle pages starrable as channels', () => {
    expect(getPageType('https://m.youtube.com/@demo')).toEqual({
      home: 'yt',
      type: 'channel',
      canStar: true,
    })
  })
})

describe('removeTrackingParams', () => {
  it('removes YouTube sharing tracking parameters', () => {
    expect(removeTrackingParams('https://www.youtube.com/watch?v=abc&pp=tracking&si=tracking&t=12')).toBe(
      'https://www.youtube.com/watch?v=abc&t=12',
    )
  })
})
