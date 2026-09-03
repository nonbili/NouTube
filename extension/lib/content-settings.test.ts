import { describe, expect, it } from 'bun:test'
import { getClickbaitThumbnail, getContentSettings, getHideShorts, getPreferH264 } from './content-settings'

describe('content settings', () => {
  it('falls back to the app defaults when nothing is stored', () => {
    const settings = getContentSettings(undefined)
    expect(settings.sponsorBlock).toBe(true)
    expect(settings.playbackRate).toBe(1)
    expect(settings.playbackQuality).toBe('auto')
    expect(getHideShorts(undefined)).toBe(true)
    expect(getPreferH264(undefined)).toBe(false)
    expect(getClickbaitThumbnail(undefined)).toBe('default')
  })

  it('passes the stored preferences through', () => {
    const settings = getContentSettings({ sponsorBlock: false, playbackRate: 1.5, showDislikes: true } as never)
    expect(settings.sponsorBlock).toBe(false)
    expect(settings.playbackRate).toBe(1.5)
    expect(settings.showDislikes).toBe(true)
  })

  it('reports the features the shell owns as off', () => {
    const settings = getContentSettings({ miniPlayer: true, translateComments: true, doubleTapToToggleHeader: true } as never)
    expect(settings.miniPlayer).toBe(false)
    expect(settings.translateComments).toBe(false)
    expect(settings.doubleTapToToggleHeader).toBe(false)
    expect(settings.captionStyle).toBeNull()
  })

  it('only accepts the clickbait frames the content bundle knows', () => {
    expect(getClickbaitThumbnail({ clickbaitThumbnail: 'hq2' } as never)).toBe('hq2')
    expect(getClickbaitThumbnail({ clickbaitThumbnail: 'hq9' } as never)).toBe('default')
  })
})
