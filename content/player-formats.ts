import type { PlayerFormat, PlayerFormatsPayload } from '../lib/player-formats'

// The download menu used to wait on yt-dlp just to learn which resolutions and codecs exist.
// The page already has that list: the player carries it for the video being watched, and
// /youtubei/v1/player returns it for any other video in a few hundred milliseconds, with the
// webview's own cookies. Downloading still goes through yt-dlp.

const getPlayer = (): any => document.getElementById('movie_player')

const trimFormat = (format: any): PlayerFormat => ({
  itag: format?.itag,
  mimeType: format?.mimeType,
  qualityLabel: format?.qualityLabel,
  height: format?.height,
  fps: format?.fps,
  bitrate: format?.bitrate,
  averageBitrate: format?.averageBitrate,
  contentLength: format?.contentLength,
})

// Only the fields the format list needs travel over the bridge — a full player response is
// megabytes of things nothing here reads.
const trimResponse = (response: any): PlayerFormatsPayload | null => {
  const streamingData = response?.streamingData
  const formats = [...(streamingData?.formats ?? []), ...(streamingData?.adaptiveFormats ?? [])]
  if (!formats.length) return null
  return {
    videoId: response?.videoDetails?.videoId ?? '',
    title: response?.videoDetails?.title ?? '',
    formats: formats.map(trimFormat),
  }
}

// The player response of the video on screen — no request at all.
const fromCurrentPlayer = (videoId: string): PlayerFormatsPayload | null => {
  try {
    const response = getPlayer()?.getPlayerResponse?.()
    if (!response || response?.videoDetails?.videoId !== videoId) return null
    return trimResponse(response)
  } catch {
    return null
  }
}

const ytcfgValue = (key: string) => {
  const ytcfg = (window as any).ytcfg
  try {
    return ytcfg?.get?.(key) ?? ytcfg?.data_?.[key]
  } catch {
    return ytcfg?.data_?.[key]
  }
}

const fetchPlayerResponse = async (videoId: string): Promise<PlayerFormatsPayload | null> => {
  const context = ytcfgValue('INNERTUBE_CONTEXT')
  if (!context) return null
  const key = ytcfgValue('INNERTUBE_API_KEY')
  const response = await fetch(`/youtubei/v1/player?prettyPrint=false${key ? `&key=${key}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, videoId, contentCheckOk: true, racyCheckOk: true }),
  })
  if (!response.ok) return null
  const json = await response.json()
  // Age-gated, members-only and geo-blocked videos come back without usable streams; yt-dlp,
  // which can use the login cookies properly, is the better answer for those.
  const status = json?.playabilityStatus?.status
  if (status && status !== 'OK') return null
  return trimResponse(json)
}

export const getPlayerFormats = async (videoId: string): Promise<PlayerFormatsPayload | null> =>
  fromCurrentPlayer(videoId) ?? fetchPlayerResponse(videoId).catch(() => null)
