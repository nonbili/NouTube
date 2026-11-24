import { describe, expect, test } from 'bun:test'
import { renderThumbarIconBitmap, THUMBAR_ICON_SIZE, type ThumbarIconName } from '../src/main/lib/thumbar-icons'

function maxAlpha(pixels: Buffer) {
  let max = 0
  for (let i = 3; i < pixels.length; i += 4) max = Math.max(max, pixels[i])
  return max
}

describe('renderThumbarIconBitmap', () => {
  const icons: ThumbarIconName[] = ['previous', 'play', 'pause', 'next']

  for (const name of icons) {
    test(`renders a premultiplied ${THUMBAR_ICON_SIZE}px bitmap for ${name}`, () => {
      const darkEnabled = renderThumbarIconBitmap(name, { dark: true, enabled: true })
      const darkDisabled = renderThumbarIconBitmap(name, { dark: true, enabled: false })
      const lightEnabled = renderThumbarIconBitmap(name, { dark: false, enabled: true })

      for (const pixels of [darkEnabled, darkDisabled, lightEnabled]) {
        expect(pixels.length).toBe(THUMBAR_ICON_SIZE * THUMBAR_ICON_SIZE * 4)
        for (let i = 0; i < pixels.length; i += 4) {
          // Premultiplied: no colour channel may exceed alpha.
          expect(pixels[i] <= pixels[i + 3]).toBe(true)
        }
      }

      expect(maxAlpha(darkEnabled)).toBe(255)
      expect(maxAlpha(darkDisabled)).toBeLessThanOrEqual(96)
      expect(darkEnabled.equals(lightEnabled)).toBe(false)
    })
  }

  test('play and pause glyphs differ', () => {
    const options = { dark: true, enabled: true }
    expect(renderThumbarIconBitmap('play', options).equals(renderThumbarIconBitmap('pause', options))).toBe(false)
  })
})
