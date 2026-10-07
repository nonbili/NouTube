import { describe, expect, it } from 'bun:test'
import { getPlaylistNeighborUrl } from './playlist-nav'

const entry = (videoId: string, selected = false) => ({ playlistPanelVideoRenderer: { videoId, selected } })
const button = (videoId: string, url?: string) => ({
  buttonRenderer: {
    command: {
      commandMetadata: { webCommandMetadata: { url } },
      watchEndpoint: { videoId, playlistId: 'PL1' },
    },
  },
})

const data = {
  playlistId: 'PL1',
  contents: [entry('aaa'), entry('bbb', true), entry('ccc')],
  previousButtonVideo: button('aaa', '/watch?v=aaa&list=PL1&index=1'),
  nextButtonVideo: button('ccc', '/watch?v=ccc&list=PL1&index=3'),
}

describe('getPlaylistNeighborUrl', () => {
  it('follows the playlist skip buttons', () => {
    expect(getPlaylistNeighborUrl(data, 'next', 'bbb')).toBe('/watch?v=ccc&list=PL1&index=3')
    expect(getPlaylistNeighborUrl(data, 'previous', 'bbb')).toBe('/watch?v=aaa&list=PL1&index=1')
  })

  it('falls back to the entries around the selected one', () => {
    const { contents, playlistId } = data
    expect(getPlaylistNeighborUrl({ contents, playlistId }, 'next')).toBe('/watch?v=ccc&list=PL1')
    expect(getPlaylistNeighborUrl({ contents, playlistId }, 'previous')).toBe('/watch?v=aaa&list=PL1')
  })

  it('ignores a playlist that is about another video', () => {
    expect(getPlaylistNeighborUrl(data, 'next', 'zzz')).toBeUndefined()
    expect(getPlaylistNeighborUrl(undefined, 'next', 'bbb')).toBeUndefined()
  })

  it('has nothing past the ends of the playlist', () => {
    const contents = [entry('aaa', true), entry('bbb')]
    expect(getPlaylistNeighborUrl({ contents, previousButtonVideo: button('aaa') }, 'previous', 'aaa')).toBeUndefined()
    expect(getPlaylistNeighborUrl({ contents: [entry('aaa'), entry('bbb', true)] }, 'next', 'bbb')).toBeUndefined()
  })
})
