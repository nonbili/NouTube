import { t } from 'i18next'
import type { FormatOption } from './main-client'

// The format metadata YouTube's own player already has on the page: reading it is instant,
// where asking yt-dlp for the same list costs an extractor bootstrap (a Python interpreter on
// Android) before a single byte is downloaded. Only the fields the format list renders are
// carried across the webview bridge, so the payload stays small.
export type PlayerFormat = {
  itag?: number
  mimeType?: string
  qualityLabel?: string
  height?: number
  fps?: number
  bitrate?: number
  averageBitrate?: number
  contentLength?: string
}

export type PlayerFormatsPayload = {
  videoId?: string
  title?: string
  formats?: PlayerFormat[]
}

// yt-dlp's shape, so the labels below stay comparable with the ones the yt-dlp path builds.
type RawFormat = {
  formatId: string
  ext: string
  vcodec: string
  acodec: string
  height: number
  fps: number
  tbr: number
  abr: number
  filesize: number
}

const CODEC_LABELS: [RegExp, string][] = [
  [/^(avc1|h264)/, 'H.264'],
  [/^vp0?9/, 'VP9'],
  [/^av01/, 'AV1'],
  [/^vp0?8/, 'VP8'],
  [/^opus/, 'Opus'],
  [/^(mp4a|aac)/, 'AAC'],
  [/^(ec-3|ac-3)/, 'AC-3'],
]

export const codecLabel = (codec: string): string => {
  const found = CODEC_LABELS.find(([re]) => re.test(codec))
  return found ? found[1] : codec.split('.')[0]
}

const formatSize = (bytes: number): string => {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  return mb >= 1024 ? `~${(mb / 1024).toFixed(1)} GB` : `~${Math.round(mb)} MB`
}

// video/mp4; codecs="avc1.640028, mp4a.40.2"
const EXTS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
}

const toRawFormat = (format: PlayerFormat): RawFormat | undefined => {
  const mimeType = format.mimeType ?? ''
  const mime = mimeType.split(';')[0].trim()
  const codecs = (mimeType.match(/codecs="([^"]*)"/)?.[1] ?? '')
    .split(',')
    .map((codec) => codec.trim())
    .filter(Boolean)
  if (!format.itag || !mime || !codecs.length) return undefined

  const isAudio = mime.startsWith('audio/')
  const bitrate = format.averageBitrate || format.bitrate || 0
  return {
    formatId: String(format.itag),
    ext: EXTS[mime] ?? mime.split('/')[1] ?? '',
    vcodec: isAudio ? 'none' : codecs[0],
    // A muxed format lists the video codec first and the audio codec second.
    acodec: isAudio ? codecs[0] : (codecs[1] ?? 'none'),
    height: isAudio ? 0 : (format.height ?? 0),
    fps: isAudio ? 0 : Math.round(format.fps ?? 0),
    tbr: Math.round(bitrate / 1000),
    abr: isAudio ? Math.round(bitrate / 1000) : 0,
    filesize: Number(format.contentLength ?? 0) || 0,
  }
}

const isVideoOnly = (f: RawFormat) => f.acodec === 'none'

// The itag is what yt-dlp calls this format too, but the list it would have built can differ
// from the player's — so every id carries an equivalent selector as a fallback, and a missing
// itag lands on the same resolution instead of failing the download.
const videoFormatId = (f: RawFormat) => {
  const equivalent = f.height ? `bestvideo[height<=${f.height}]+bestaudio/best[height<=${f.height}]` : 'best'
  return isVideoOnly(f) ? `${f.formatId}+bestaudio/${equivalent}` : `${f.formatId}/${equivalent}`
}

const buildCuratedOptions = (videoFormats: RawFormat[], audioFormats: RawFormat[]): FormatOption[] => {
  const options: FormatOption[] = []
  const maxHeight = Math.max(...videoFormats.map((f) => f.height), 0)

  // Only show "Best quality" when there is something above 1080p, otherwise the 1080p option
  // covers it.
  if (maxHeight > 1080) {
    options.push({
      formatId: 'bestvideo+bestaudio/best',
      label: t('native.format_bestQuality'),
      description: t('native.format_bestQualityDesc', { height: maxHeight }),
    })
  }

  if (videoFormats.some((f) => f.height === 1080)) {
    options.push({
      formatId: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
      label: '1080p',
      description: t('native.format_1080pDesc'),
    })
  }

  if (videoFormats.some((f) => f.height === 720)) {
    options.push({
      formatId: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
      label: '720p',
      description: t('native.format_720pDesc'),
    })
  }

  if (audioFormats.length) {
    const best = audioFormats.reduce((a, b) => (b.abr > a.abr ? b : a))
    options.push({
      formatId: 'bestaudio/best',
      label: best.ext ? t('native.format_audio', { ext: best.ext }) : t('native.format_audioOnly'),
      description: t('native.format_audioStreamDesc'),
    })
    options.push({
      formatId: 'bestaudio-mp3',
      label: t('native.format_audio', { ext: 'mp3' }),
      description: t('native.format_audioMp3Desc'),
    })
  }

  return options
}

// Every distinct resolution/codec pair the player knows about, mirroring what the yt-dlp path
// lists so a pinned format keeps resolving across both.
const buildAdvancedOptions = (videoFormats: RawFormat[], audioFormats: RawFormat[]): FormatOption[] => {
  const options: FormatOption[] = []

  const bestPerVariant = new Map<string, RawFormat>()
  for (const f of videoFormats) {
    const key = `${f.height}-${f.fps}-${codecLabel(f.vcodec)}`
    const current = bestPerVariant.get(key)
    // Video-only wins over the muxed variant of the same resolution: it can be paired with
    // the best audio stream instead of the low-bitrate audio baked into the muxed format.
    const better =
      !current ||
      (isVideoOnly(f) && !isVideoOnly(current)) ||
      (isVideoOnly(f) === isVideoOnly(current) && f.tbr > current.tbr)
    if (better) bestPerVariant.set(key, f)
  }

  const variants = Array.from(bestPerVariant.values()).sort(
    (a, b) => b.height - a.height || b.fps - a.fps || b.tbr - a.tbr,
  )

  for (const f of variants) {
    options.push({
      formatId: videoFormatId(f),
      label: `${f.height}p${f.fps > 30 ? f.fps : ''} ${codecLabel(f.vcodec)}`,
      description: [f.ext.toUpperCase(), formatSize(f.filesize)].filter(Boolean).join(' · '),
      advanced: true,
      kind: 'video',
      height: f.height,
      fps: f.fps,
      codec: codecLabel(f.vcodec),
    })
  }

  const bestPerAudioCodec = new Map<string, RawFormat>()
  for (const f of audioFormats) {
    const key = codecLabel(f.acodec)
    const current = bestPerAudioCodec.get(key)
    if (!current || f.abr > current.abr) bestPerAudioCodec.set(key, f)
  }

  for (const f of bestPerAudioCodec.values()) {
    options.push({
      formatId: `${f.formatId}/bestaudio/best`,
      label: `Audio ${codecLabel(f.acodec)}`,
      description: [f.ext.toUpperCase(), f.abr ? `${f.abr} kbps` : '', formatSize(f.filesize)]
        .filter(Boolean)
        .join(' · '),
      advanced: true,
      kind: 'audio',
      codec: codecLabel(f.acodec),
    })
  }

  return options
}

export const buildFormatOptionsFromPlayer = (
  payload: PlayerFormatsPayload | null | undefined,
): { title: string; formats: FormatOption[] } | undefined => {
  const raw = (payload?.formats ?? []).map(toRawFormat).filter((f): f is RawFormat => !!f)
  const videoFormats = raw.filter((f) => f.vcodec !== 'none' && f.height > 0)
  const audioFormats = raw.filter((f) => f.vcodec === 'none' && f.acodec !== 'none')
  if (!videoFormats.length && !audioFormats.length) return undefined

  return {
    title: payload?.title ?? '',
    formats: [...buildCuratedOptions(videoFormats, audioFormats), ...buildAdvancedOptions(videoFormats, audioFormats)],
  }
}
