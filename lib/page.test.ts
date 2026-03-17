import { describe, expect, it } from 'bun:test'
import { getPageType } from './page-type'

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
