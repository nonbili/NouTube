/**
 * Android exposes the user's system-wide caption preferences through
 * CaptioningManager, but WebView never forwards them to web content, and
 * YouTube paints captions as its own DOM spans rather than a native <track>,
 * so `::cue` would not help either. The native module reads the preferences
 * and the content script turns them into overrides for YouTube's caption DOM.
 */

export interface SystemCaptionStyle {
  enabled: boolean
  fontScale: number
  locale?: string | null
  /** ARGB ints as returned by CaptionStyle, null when the user left it unset. */
  foregroundColor?: number | null
  backgroundColor?: number | null
  windowColor?: number | null
  /** CaptionStyle.EDGE_TYPE_*: 0 none, 1 outline, 2 drop shadow, 3 raised, 4 depressed. */
  edgeType?: number | null
  edgeColor?: number | null
}

export const normalizeSystemCaptionStyle = (value: any): SystemCaptionStyle | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    enabled: Boolean(value.enabled),
    fontScale: typeof value.fontScale === 'number' && value.fontScale > 0 ? value.fontScale : 1,
    locale: typeof value.locale === 'string' ? value.locale : null,
    foregroundColor: number(value.foregroundColor),
    backgroundColor: number(value.backgroundColor),
    windowColor: number(value.windowColor),
    edgeType: number(value.edgeType),
    edgeColor: number(value.edgeColor),
  }
}

/** Android hands out ARGB as a signed int, so shift with >>> to get the unsigned bytes. */
export const argbToCssColor = (argb: number) => {
  const alpha = (argb >>> 24) & 0xff
  const red = (argb >>> 16) & 0xff
  const green = (argb >>> 8) & 0xff
  const blue = argb & 0xff
  return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`
}

const edgeShadow = (edgeType: number, color: string) => {
  switch (edgeType) {
    case 1: // outline
      return `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`
    case 2: // drop shadow
      return `2px 2px 2px ${color}`
    case 3: // raised
      return `1px 1px 0 ${color}`
    case 4: // depressed
      return `-1px -1px 0 ${color}`
    default:
      return 'none'
  }
}

/**
 * YouTube's caption font size is a step index rather than a scale factor:
 * -1/0/1/2/3 render at 75/100/150/200/300 percent. The player clamps anything
 * below -1, so Android's 0.5 scale lands on the same smallest step as 0.75.
 */
export const captionFontSizeIncrement = (fontScale: number) => {
  if (fontScale <= 0.87) return -1
  if (fontScale <= 1.25) return 0
  if (fontScale <= 1.75) return 1
  if (fontScale <= 2.5) return 2
  return 3
}

/**
 * YouTube inline-styles every caption segment, so each declaration needs
 * !important to win. Text sits on `.ytp-caption-segment` (desktop) and on the
 * spans inside `.captions-text` (mobile); the surrounding box is
 * `.caption-window`.
 */
export const buildCaptionCss = (style?: SystemCaptionStyle | null) => {
  if (!style?.enabled) {
    return ''
  }

  const textRules: string[] = []
  const segmentRules: string[] = []
  const windowRules: string[] = []

  if (style.foregroundColor != null) {
    textRules.push(`color: ${argbToCssColor(style.foregroundColor)} !important;`)
  }
  if (style.backgroundColor != null) {
    segmentRules.push(`background-color: ${argbToCssColor(style.backgroundColor)} !important;`)
  }
  if (style.edgeType != null) {
    textRules.push(`text-shadow: ${edgeShadow(style.edgeType, argbToCssColor(style.edgeColor ?? 0xff000000))} !important;`)
  }
  if (style.windowColor != null) {
    windowRules.push(`background-color: ${argbToCssColor(style.windowColor)} !important;`)
  }

  const blocks: string[] = []
  if (textRules.length) {
    blocks.push(`.ytp-caption-segment,\n.captions-text,\n.captions-text span {\n  ${textRules.join('\n  ')}\n}`)
  }
  if (segmentRules.length) {
    // Only the segments carry the caption background; painting the container
    // too would double up the alpha on multi-line captions.
    blocks.push(`.ytp-caption-segment,\n.captions-text span {\n  ${segmentRules.join('\n  ')}\n}`)
  }
  if (windowRules.length) {
    blocks.push(`.caption-window {\n  ${windowRules.join('\n  ')}\n}`)
  }
  return blocks.join('\n\n')
}
