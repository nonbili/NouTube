export type ThumbarIconName = 'previous' | 'play' | 'pause' | 'next'

export const THUMBAR_ICON_SIZE = 32
const SUPERSAMPLE = 4

function inRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1
}

function inTriangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function hitGlyph(name: ThumbarIconName, x: number, y: number): boolean {
  switch (name) {
    case 'play':
      return inTriangle(x, y, 0.28, 0.18, 0.82, 0.5, 0.28, 0.82)
    case 'pause':
      return inRect(x, y, 0.24, 0.2, 0.42, 0.8) || inRect(x, y, 0.58, 0.2, 0.76, 0.8)
    case 'previous':
      return inRect(x, y, 0.18, 0.22, 0.28, 0.78) || inTriangle(x, y, 0.8, 0.22, 0.8, 0.78, 0.34, 0.5)
    case 'next':
      return inTriangle(x, y, 0.2, 0.22, 0.2, 0.78, 0.66, 0.5) || inRect(x, y, 0.72, 0.22, 0.82, 0.78)
  }
}

/**
 * Raw pixels for nativeImage.createFromBitmap: 32x32, premultiplied BGRA (the
 * glyph is grey, so channel order does not matter). Anti-aliased by sampling
 * each pixel 4x4 times.
 */
export function renderThumbarIconBitmap(name: ThumbarIconName, options: { dark: boolean; enabled: boolean }): Buffer {
  const color = options.dark ? 255 : 31
  const maxAlpha = options.enabled ? 255 : 96
  const size = THUMBAR_ICON_SIZE
  const pixels = Buffer.alloc(size * size * 4)
  const totalSamples = SUPERSAMPLE * SUPERSAMPLE

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const ny = (py + (sy + 0.5) / SUPERSAMPLE) / size
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          if (hitGlyph(name, (px + (sx + 0.5) / SUPERSAMPLE) / size, ny)) hits++
        }
      }
      if (!hits) continue
      const alpha = Math.round((hits / totalSamples) * maxAlpha)
      const premultiplied = Math.round((color * alpha) / 255)
      const i = (py * size + px) * 4
      pixels[i] = premultiplied
      pixels[i + 1] = premultiplied
      pixels[i + 2] = premultiplied
      pixels[i + 3] = alpha
    }
  }
  return pixels
}
