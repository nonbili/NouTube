import { describe, expect, test } from 'bun:test'
import './i18n'
import { buildFormatOptionsFromPlayer, type PlayerFormat } from './player-formats'

const video = (
  itag: number,
  height: number,
  codecs: string,
  { fps = 30, ext = 'mp4', bitrate = 1_000_000, contentLength = '10485760' } = {},
): PlayerFormat => ({
  itag,
  mimeType: `video/${ext}; codecs="${codecs}"`,
  qualityLabel: `${height}p`,
  height,
  fps,
  bitrate,
  averageBitrate: bitrate,
  contentLength,
})

const audio = (itag: number, codecs: string, { ext = 'mp4', bitrate = 128_000 } = {}): PlayerFormat => ({
  itag,
  mimeType: `audio/${ext}; codecs="${codecs}"`,
  bitrate,
  averageBitrate: bitrate,
  contentLength: '3145728',
})

const payload = (formats: PlayerFormat[]) => ({ videoId: 'abc12345678', title: 'A video', formats })

describe('buildFormatOptionsFromPlayer', () => {
  test('returns undefined without usable streams', () => {
    expect(buildFormatOptionsFromPlayer(null)).toBeUndefined()
    expect(buildFormatOptionsFromPlayer(payload([]))).toBeUndefined()
    expect(buildFormatOptionsFromPlayer(payload([{ itag: 18 }]))).toBeUndefined()
  })

  test('labels a video variant by resolution, frame rate and codec', () => {
    const result = buildFormatOptionsFromPlayer(
      payload([video(303, 1080, 'vp09.00.40.08', { fps: 60, ext: 'webm' })]),
    )
    const option = result?.formats.find((opt) => opt.advanced)
    expect(option?.label).toBe('1080p60 VP9')
    expect(option?.description).toBe('WEBM · ~10 MB')
    expect(option).toMatchObject({ kind: 'video', height: 1080, fps: 60, codec: 'VP9' })
  })

  test('curates best/1080p/720p and audio entries', () => {
    const result = buildFormatOptionsFromPlayer(
      payload([
        video(401, 2160, 'av01.0.12M.08'),
        video(137, 1080, 'avc1.640028'),
        video(136, 720, 'avc1.4d401f'),
        audio(140, 'mp4a.40.2'),
      ]),
    )
    expect(result?.formats.filter((opt) => !opt.advanced).map((opt) => opt.label)).toEqual([
      'Best quality',
      '1080p',
      '720p',
      'Audio (m4a)',
      'Audio (mp3)',
    ])
    expect(result?.formats[0].description).toBe('Up to 2160p video + audio')
  })

  test('pairs a video-only format with the best audio and keeps a fallback selector', () => {
    const result = buildFormatOptionsFromPlayer(payload([video(137, 1080, 'avc1.640028')]))
    const option = result?.formats.find((opt) => opt.advanced)
    expect(option?.formatId).toBe('137+bestaudio/bestvideo[height<=1080]+bestaudio/best[height<=1080]')
  })

  test('prefers the video-only stream over the muxed one of the same variant', () => {
    const result = buildFormatOptionsFromPlayer(
      payload([video(18, 360, 'avc1.42001E, mp4a.40.2'), video(134, 360, 'avc1.4d401e')]),
    )
    const options = result?.formats.filter((opt) => opt.kind === 'video')
    expect(options).toHaveLength(1)
    expect(options?.[0].formatId).toStartWith('134+bestaudio/')
  })

  test('keeps the best stream per audio codec', () => {
    const result = buildFormatOptionsFromPlayer(
      payload([
        audio(139, 'mp4a.40.5', { bitrate: 48_000 }),
        audio(140, 'mp4a.40.2', { bitrate: 128_000 }),
        audio(251, 'opus', { ext: 'webm', bitrate: 160_000 }),
      ]),
    )
    const options = result?.formats.filter((opt) => opt.kind === 'audio')
    expect(options?.map((opt) => opt.label)).toEqual(['Audio AAC', 'Audio Opus'])
    expect(options?.[0].formatId).toBe('140/bestaudio/best')
    expect(options?.[0].description).toBe('M4A · 128 kbps · ~3 MB')
  })
})
