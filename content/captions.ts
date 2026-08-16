import { buildCaptionCss, captionFontSizeIncrement, type SystemCaptionStyle } from '../lib/captions'
import { noutubeSettingsEvent } from './noutube'

let player: any = null

/**
 * setOption persists into YouTube's own caption preferences, so the size the
 * user picked there has to be stashed somewhere that survives a reload —
 * otherwise a later reload would read our override back as the "original".
 */
const savedFontSizeKey = 'nou:caption-font-size'

const readSavedFontSize = () => {
  try {
    const raw = localStorage.getItem(savedFontSizeKey)
    if (raw == null) {
      return null
    }
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export const getSystemCaptionStyle = (): SystemCaptionStyle | null =>
  ((window.NouTube?.getSettings?.() as any)?.captionStyle as SystemCaptionStyle) || null

export const getCaptionCss = () => buildCaptionCss(getSystemCaptionStyle())

/**
 * Caption size is the one preference CSS cannot carry: YouTube writes an
 * inline px font-size derived from the player box, so a static override loses
 * on rotation and fullscreen. The player's own captions option survives those
 * relayouts, but it only exists once the captions module has loaded, hence the
 * onApiChange hook in player.ts.
 */
export function applyCaptionFontScale(el?: any) {
  if (el) {
    player = el
  }
  const target = player || document.getElementById('movie_player')
  if (!target || typeof target.setOption !== 'function') {
    return
  }
  // The captions module is loaded lazily; until it is there both getOption and
  // setOption are no-ops, and reading a size back would be meaningless.
  const modules = target.getOptions?.()
  if (!Array.isArray(modules) || !modules.includes('captions')) {
    return
  }

  const style = getSystemCaptionStyle()
  const saved = readSavedFontSize()

  if (!style?.enabled) {
    // Turning the setting off has to give the user's own size back, not
    // YouTube's default.
    if (saved != null) {
      try {
        target.setOption('captions', 'fontSize', saved)
        localStorage.removeItem(savedFontSizeKey)
      } catch {}
    }
    return
  }

  // Remembering the original size is best-effort: if storage is unavailable the
  // system scale should still take effect for this player.
  if (saved == null) {
    try {
      const current = target.getOption?.('captions', 'fontSize')
      localStorage.setItem(savedFontSizeKey, String(typeof current === 'number' ? current : 0))
    } catch {}
  }

  try {
    target.setOption('captions', 'fontSize', captionFontSizeIncrement(style.fontScale))
  } catch {}
}

export function installSystemCaptionStyle() {
  // The CSS half rides on the shared injected stylesheet, which already
  // re-renders on this event; only the font size needs its own re-apply.
  window.addEventListener(noutubeSettingsEvent, () => applyCaptionFontScale())
  applyCaptionFontScale()
}
