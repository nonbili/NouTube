import { describe, expect, it } from 'bun:test'
import { argbToCssColor, buildCaptionCss, captionFontSizeIncrement, normalizeSystemCaptionStyle } from './captions'

describe('captions', () => {
  it('converts the signed ARGB ints Android returns', () => {
    // 0xFFFFFFFF arrives as -1 through the JSI Int bridge.
    expect(argbToCssColor(-1)).toBe('rgba(255, 255, 255, 1.000)')
    expect(argbToCssColor(0x80ff0000)).toBe('rgba(255, 0, 0, 0.502)')
  })

  it('emits no css when captioning is off', () => {
    expect(buildCaptionCss(null)).toBe('')
    expect(buildCaptionCss({ enabled: false, fontScale: 2, foregroundColor: -1 })).toBe('')
  })

  it('only overrides the fields the user actually set', () => {
    const css = buildCaptionCss({ enabled: true, fontScale: 1, foregroundColor: -1 })
    expect(css).toContain('color: rgba(255, 255, 255, 1.000) !important;')
    expect(css).not.toContain('background-color')
    expect(css).not.toContain('.caption-window')
  })

  it('maps edge type to a text shadow', () => {
    const outline = buildCaptionCss({ enabled: true, fontScale: 1, edgeType: 1, edgeColor: -16777216 })
    expect(outline).toContain('text-shadow: -1px -1px 0 rgba(0, 0, 0, 1.000)')
    const none = buildCaptionCss({ enabled: true, fontScale: 1, edgeType: 0 })
    expect(none).toContain('text-shadow: none !important;')
  })

  it('snaps font scale to YouTube caption size steps', () => {
    // -1 is the smallest step the player accepts, so 50% cannot go lower.
    expect(captionFontSizeIncrement(0.5)).toBe(-1)
    expect(captionFontSizeIncrement(0.75)).toBe(-1)
    expect(captionFontSizeIncrement(1)).toBe(0)
    expect(captionFontSizeIncrement(1.5)).toBe(1)
    expect(captionFontSizeIncrement(2)).toBe(2)
    expect(captionFontSizeIncrement(4)).toBe(3)
  })

  it('normalizes missing native fields', () => {
    expect(normalizeSystemCaptionStyle(undefined)).toBeNull()
    expect(normalizeSystemCaptionStyle({ enabled: true })).toEqual({
      enabled: true,
      fontScale: 1,
      locale: null,
      foregroundColor: null,
      backgroundColor: null,
      windowColor: null,
      edgeType: null,
      edgeColor: null,
    })
  })
})
