import { describe, expect, test } from 'bun:test'
import { findPinnedFormat, findPinnedFormats, toDownloadPreset, togglePinnedFormat } from './download-format'
import type { FormatOption } from './main-client'

const video = (formatId: string, height: number, codec: string, fps = 30): FormatOption => ({
  formatId,
  label: `${height}p ${codec}`,
  description: '',
  advanced: true,
  kind: 'video',
  height,
  fps,
  codec,
})

const audio = (formatId: string, codec: string): FormatOption => ({
  formatId,
  label: `Audio ${codec}`,
  description: '',
  advanced: true,
  kind: 'audio',
  codec,
})

const curated = (formatId: string, label: string): FormatOption => ({ formatId, label, description: '' })

const formats: FormatOption[] = [
  curated('bestvideo[height<=1080]+bestaudio/best[height<=1080]', '1080p'),
  curated('bestaudio-mp3', 'Audio (mp3)'),
  video('271+bestaudio/best', 1440, 'VP9'),
  video('137+bestaudio/best', 1080, 'H.264'),
  video('248+bestaudio/best', 1080, 'VP9'),
  video('299+bestaudio/best', 1080, 'H.264', 60),
  video('136+bestaudio/best', 720, 'H.264'),
  audio('251', 'Opus'),
  audio('140', 'AAC'),
]

describe('findPinnedFormat', () => {
  test('matches a curated pin by format id', () => {
    const preset = toDownloadPreset(formats[0])
    expect(findPinnedFormat(formats, preset)?.formatId).toBe('bestvideo[height<=1080]+bestaudio/best[height<=1080]')
    expect(findPinnedFormat([formats[1]], preset)).toBeUndefined()
  })

  test('matches resolution, codec and frame rate exactly when available', () => {
    expect(findPinnedFormat(formats, { kind: 'video', height: 1080, fps: 30, codec: 'VP9' })?.formatId).toBe(
      '248+bestaudio/best',
    )
    expect(findPinnedFormat(formats, { kind: 'video', height: 1080, fps: 60, codec: 'H.264' })?.formatId).toBe(
      '299+bestaudio/best',
    )
  })

  test('falls back to the same codec at a lower resolution', () => {
    const only720 = formats.filter((f) => f.height !== 1080 && f.height !== 1440)
    expect(findPinnedFormat(only720, { kind: 'video', height: 1080, fps: 30, codec: 'H.264' })?.formatId).toBe(
      '136+bestaudio/best',
    )
  })

  test('prefers the pinned resolution over the pinned codec', () => {
    expect(findPinnedFormat(formats, { kind: 'video', height: 1440, fps: 30, codec: 'AV1' })?.formatId).toBe(
      '271+bestaudio/best',
    )
  })

  test('prefers the exact frame rate over another one in the same bucket', () => {
    const fpsVariants = [
      video('303+bestaudio/best', 1080, 'VP9', 60),
      video('302+bestaudio/best', 1080, 'VP9', 50),
      video('248+bestaudio/best', 1080, 'VP9', 30),
      video('247+bestaudio/best', 1080, 'VP9', 24),
    ]
    expect(findPinnedFormat(fpsVariants, { kind: 'video', height: 1080, fps: 50, codec: 'VP9' })?.formatId).toBe(
      '302+bestaudio/best',
    )
    expect(findPinnedFormat(fpsVariants, { kind: 'video', height: 1080, fps: 24, codec: 'VP9' })?.formatId).toBe(
      '247+bestaudio/best',
    )
  })

  test('falls back within the frame rate bucket when the exact one is gone', () => {
    const noFifty = [video('303+bestaudio/best', 1080, 'VP9', 60), video('248+bestaudio/best', 1080, 'VP9', 30)]
    expect(findPinnedFormat(noFifty, { kind: 'video', height: 1080, fps: 50, codec: 'VP9' })?.formatId).toBe(
      '303+bestaudio/best',
    )
  })

  test('goes up in resolution only when nothing lower exists', () => {
    expect(findPinnedFormat(formats, { kind: 'video', height: 360, fps: 30, codec: 'VP9' })?.formatId).toBe(
      '136+bestaudio/best',
    )
    const only1440 = [formats[2]]
    expect(findPinnedFormat(only1440, { kind: 'video', height: 360, fps: 30, codec: 'VP9' })?.formatId).toBe(
      '271+bestaudio/best',
    )
  })

  test('matches audio by codec and falls back to any audio', () => {
    expect(findPinnedFormat(formats, { kind: 'audio', codec: 'AAC' })?.formatId).toBe('140')
    expect(findPinnedFormat(formats, { kind: 'audio', codec: 'AC-3' })?.formatId).toBe('251')
    expect(findPinnedFormat([formats[3]], { kind: 'audio', codec: 'Opus' })).toBeUndefined()
  })
})

describe('findPinnedFormats', () => {
  test('marks a pin regardless of the format id it resolves to', () => {
    const presets = [{ kind: 'video' as const, height: 1080, fps: 30, codec: 'VP9' }]
    const renumbered = [video('999+bestaudio/best', 1080, 'VP9')]
    expect(findPinnedFormats(renumbered, presets).map((pinned) => pinned.format.formatId)).toEqual([
      '999+bestaudio/best',
    ])
    expect(findPinnedFormats(formats, []).length).toBe(0)
  })

  test('reports every preset a format was pinned by', () => {
    const presets = [
      { kind: 'video' as const, height: 1080, fps: 30, codec: 'VP9' },
      { kind: 'video' as const, height: 1080, fps: 24, codec: 'VP9' },
    ]
    const only1080Vp9 = [formats[4]]
    const pinned = findPinnedFormats(only1080Vp9, presets)
    expect(pinned.length).toBe(1)
    expect(pinned[0].presets).toEqual(presets)
  })
})

describe('multiple pins', () => {
  test('adds and removes pins, keeping the order they were added in', () => {
    let presets = togglePinnedFormat([], formats[4])
    presets = togglePinnedFormat(presets, formats[7])
    expect(presets).toEqual([
      { kind: 'video', height: 1080, fps: 30, codec: 'VP9' },
      { kind: 'audio', codec: 'Opus' },
    ])

    const pinned = findPinnedFormats(formats, presets).find((match) => match.format.formatId === formats[4].formatId)
    presets = togglePinnedFormat(presets, formats[4], pinned)
    expect(presets).toEqual([{ kind: 'audio', codec: 'Opus' }])
  })

  test('unpinning a fallback removes the preset that put it there', () => {
    // 1080p VP9 is pinned, but this video only has 720p H.264 — the pin resolves to it.
    const presets = [{ kind: 'video' as const, height: 1080, fps: 30, codec: 'VP9' }]
    const only720 = [formats[6]]
    const [pinned] = findPinnedFormats(only720, presets)
    expect(pinned.format.formatId).toBe('136+bestaudio/best')
    expect(togglePinnedFormat(presets, pinned.format, pinned)).toEqual([])
  })

  test('pinning a format that no pin resolved to adds it', () => {
    const presets = [{ kind: 'audio' as const, codec: 'Opus' }]
    expect(togglePinnedFormat(presets, formats[3], undefined)).toEqual([
      { kind: 'audio', codec: 'Opus' },
      { kind: 'video', height: 1080, fps: 30, codec: 'H.264' },
    ])
  })

  test('resolves every pin against the current video', () => {
    const presets = [
      { kind: 'video' as const, height: 1080, fps: 30, codec: 'VP9' },
      { kind: 'audio' as const, codec: 'AAC' },
      { kind: 'curated' as const, formatId: 'bestaudio-mp3' },
    ]
    expect(findPinnedFormats(formats, presets).map((pinned) => pinned.format.formatId)).toEqual([
      '248+bestaudio/best',
      '140',
      'bestaudio-mp3',
    ])
  })

  test('drops pins with no match and dedupes pins that resolve to the same option', () => {
    const presets = [
      { kind: 'video' as const, height: 1080, fps: 30, codec: 'VP9' },
      { kind: 'video' as const, height: 1080, fps: 60, codec: 'VP9' },
      { kind: 'curated' as const, formatId: 'bestvideo+bestaudio/best' },
    ]
    const only1080Vp9 = [formats[4]]
    expect(findPinnedFormats(only1080Vp9, presets).map((pinned) => pinned.format.formatId)).toEqual([
      '248+bestaudio/best',
    ])
  })
})

describe('frame rate variants are pinned separately', () => {
  test('unpinning 60 fps leaves the 50 fps pin alone', () => {
    const fifty = video('302+bestaudio/best', 1080, 'VP9', 50)
    const sixty = video('303+bestaudio/best', 1080, 'VP9', 60)
    let presets = togglePinnedFormat([], fifty)
    presets = togglePinnedFormat(presets, sixty)
    expect(presets).toHaveLength(2)

    const pinnedSixty = findPinnedFormats([fifty, sixty], presets).find(
      (match) => match.format.formatId === sixty.formatId,
    )
    presets = togglePinnedFormat(presets, sixty, pinnedSixty)
    expect(presets).toEqual([{ kind: 'video', height: 1080, fps: 50, codec: 'VP9' }])
  })
})
