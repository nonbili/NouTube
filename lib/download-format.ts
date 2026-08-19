import type { FormatOption } from './main-client'

// A pinned format has to survive across videos, so it is stored as a description of what the
// user picked rather than as a format id: the ids of the full format list are per video, and
// the same resolution/codec pair can have a different id (or be missing) on the next one.
export type DownloadPreset =
  | { kind: 'curated'; formatId: string }
  | { kind: 'video'; height: number; fps: number; codec: string }
  | { kind: 'audio'; codec: string }

export const toDownloadPreset = (opt: FormatOption): DownloadPreset => {
  if (opt.kind === 'video') {
    return { kind: 'video', height: opt.height ?? 0, fps: opt.fps ?? 0, codec: opt.codec ?? '' }
  }
  if (opt.kind === 'audio') {
    return { kind: 'audio', codec: opt.codec ?? '' }
  }
  return { kind: 'curated', formatId: opt.formatId }
}

const isHiFps = (fps: number) => fps > 30

const isSamePreset = (a: DownloadPreset, b: DownloadPreset) => {
  if (a.kind !== b.kind) return false
  if (a.kind === 'curated' && b.kind === 'curated') return a.formatId === b.formatId
  if (a.kind === 'video' && b.kind === 'video') {
    return a.height === b.height && a.fps === b.fps && a.codec === b.codec
  }
  if (a.kind === 'audio' && b.kind === 'audio') return a.codec === b.codec
  return false
}

// Resolves one pinned preset against the options of the current video. An exact match is
// preferred; otherwise the closest resolution wins, then the codec, then the exact frame rate,
// and only then its high/low bucket — so a pinned 1080p50 prefers 50 fps over 60, and falls back
// to 60 rather than 30 when 50 is gone.
export const findPinnedFormat = (formats: FormatOption[], preset: DownloadPreset): FormatOption | undefined => {
  if (preset.kind === 'curated') {
    return formats.find((opt) => opt.formatId === preset.formatId)
  }

  if (preset.kind === 'audio') {
    const candidates = formats.filter((opt) => opt.kind === 'audio')
    return candidates.find((opt) => opt.codec === preset.codec) ?? candidates[0]
  }

  const candidates = formats.filter((opt) => opt.kind === 'video')
  if (!candidates.length) return undefined

  // Below the pinned resolution is a smaller download than the user asked for, above it is a
  // bigger one — so a lower resolution is preferred when the exact one is unavailable.
  const heightPenalty = (height: number) =>
    height <= preset.height ? preset.height - height : (height - preset.height) * 10

  return candidates
    .slice()
    .sort(
      (a, b) =>
        heightPenalty(a.height ?? 0) - heightPenalty(b.height ?? 0) ||
        Number(a.codec !== preset.codec) - Number(b.codec !== preset.codec) ||
        Number(a.fps !== preset.fps) - Number(b.fps !== preset.fps) ||
        Number(isHiFps(a.fps ?? 0) !== isHiFps(preset.fps)) - Number(isHiFps(b.fps ?? 0) !== isHiFps(preset.fps)),
    )[0]
}

// A preset can resolve to a format other than the one it describes, so what the modal marks as
// pinned — and unpins — is the resolved format together with every preset behind it. Matching on
// the preset alone would leave a fallback looking unpinned and impossible to remove.
export type PinnedFormat = { format: FormatOption; presets: DownloadPreset[] }

export const findPinnedFormats = (formats: FormatOption[], presets: DownloadPreset[]): PinnedFormat[] => {
  const byFormatId = new Map<string, PinnedFormat>()
  for (const preset of presets) {
    const format = findPinnedFormat(formats, preset)
    if (!format) continue
    const pinned = byFormatId.get(format.formatId)
    if (pinned) {
      pinned.presets.push(preset)
    } else {
      byFormatId.set(format.formatId, { format, presets: [preset] })
    }
  }
  return Array.from(byFormatId.values())
}

// Unpinning drops every preset that resolved to this format, so a fallback removes the pin that
// put it there rather than adding a second one.
export const togglePinnedFormat = (
  presets: DownloadPreset[],
  opt: FormatOption,
  pinned?: PinnedFormat,
): DownloadPreset[] =>
  pinned
    ? presets.filter((preset) => !pinned.presets.some((resolved) => isSamePreset(preset, resolved)))
    : [...presets, toDownloadPreset(opt)]
