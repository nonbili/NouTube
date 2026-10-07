// Discord application the activity is attributed to. Artwork needs one: the
// thumbnail has to be registered through the application's external-assets
// endpoint before the gateway accepts it. Left empty, the presence shows
// without artwork. Keep in sync with NouDiscord.kt.
export const DISCORD_APPLICATION_ID: string = '1557247525940105236'

export const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json'
export const DISCORD_API_URL = 'https://discord.com/api/v10'

// Discord rejects longer strings, and anything shorter than two characters.
const MAX_TEXT_LENGTH = 128
// A seek or a rate change moves the start timestamp; ordinary playback only
// jitters it by the reporting delay.
const TIMESTAMP_TOLERANCE_MS = 3000

export interface DiscordPlayback {
  videoId: string
  url: string
  title: string
  author: string
  thumbnail: string
  /** Seconds; 0 for a live stream. */
  duration: number
  /** Seconds. */
  current: number
  playing: boolean
  /** Playback speed; the clock Discord draws runs in real time, the video does not. */
  rate: number
  /** Which tab reported it, where there is more than one. */
  source: string
}

export interface DiscordActivity {
  name: string
  /** 2 is "Listening to", 3 is "Watching". */
  type: 2 | 3
  details?: string
  state?: string
  timestamps?: { start: number; end?: number }
  assets?: { large_image: string; large_text?: string }
  application_id?: string
}

const clip = (text: string) => {
  const trimmed = text.trim()
  if (trimmed.length < 2) {
    return undefined
  }
  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH - 1) + '…' : trimmed
}

export const isMusicUrl = (url: string) => {
  try {
    return new URL(url).hostname === 'music.youtube.com'
  } catch {
    return false
  }
}

export const parseDiscordPlayback = (data: any): DiscordPlayback | undefined => {
  const current = Number(data?.current)
  const duration = Number(data?.duration)
  const rate = Number(data?.rate)
  if (!data?.videoId || !data?.title || !Number.isFinite(current) || current < 0) {
    return undefined
  }
  return {
    videoId: String(data.videoId),
    url: String(data.url || ''),
    title: String(data.title),
    author: String(data.author || ''),
    thumbnail: String(data.thumbnail || ''),
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    current,
    playing: Boolean(data.playing),
    rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    source: String(data.source || ''),
  }
}

/**
 * The activity for what is playing, or undefined when nothing should show
 * (paused playback is hidden, the way Discord's own integrations do it).
 * `largeImage` is the thumbnail once Discord has registered it.
 */
export const buildDiscordActivity = (
  playback: DiscordPlayback | undefined,
  now: number,
  largeImage?: string,
  applicationId = DISCORD_APPLICATION_ID,
): DiscordActivity | undefined => {
  if (!playback?.playing) {
    return undefined
  }
  const music = isMusicUrl(playback.url)
  // At 2x a ten minute video is over in five, so both ends of the progress
  // bar are in wall-clock time.
  const rate = playback.rate > 0 ? playback.rate : 1
  const start = Math.round(now - (playback.current * 1000) / rate)
  const activity: DiscordActivity = {
    name: music ? 'YouTube Music' : 'YouTube',
    type: music ? 2 : 3,
    details: clip(playback.title),
    state: clip(playback.author),
    timestamps: playback.duration > 0 ? { start, end: Math.round(start + (playback.duration * 1000) / rate) } : { start },
  }
  if (applicationId) {
    activity.application_id = applicationId
    if (largeImage) {
      activity.assets = { large_image: largeImage, large_text: clip(playback.title) }
    }
  }
  return activity
}

/** Whether `next` is worth another presence update after `prev` was sent. */
export const isDiscordActivityChanged = (prev: DiscordActivity | undefined, next: DiscordActivity | undefined) => {
  if (!prev || !next) {
    return prev !== next
  }
  if (
    prev.name !== next.name ||
    prev.details !== next.details ||
    prev.state !== next.state ||
    prev.assets?.large_image !== next.assets?.large_image
  ) {
    return true
  }
  const startDrift = Math.abs((prev.timestamps?.start ?? 0) - (next.timestamps?.start ?? 0))
  const endDrift = Math.abs((prev.timestamps?.end ?? 0) - (next.timestamps?.end ?? 0))
  return startDrift > TIMESTAMP_TOLERANCE_MS || endDrift > TIMESTAMP_TOLERANCE_MS
}
