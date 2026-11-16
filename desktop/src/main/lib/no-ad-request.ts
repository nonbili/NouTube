import { gunzipSync } from 'node:zlib'

// Player params that ask YouTube for a playback without ads. Stripping the ad
// slots from a response is not enough: YouTube then holds back the video stream
// for as long as the pre-roll would have run (~5-10s). Asking for no ads up
// front avoids scheduling the pre-roll at all. Same value uBlock filters use.
export const NO_AD_PLAYER_PARAMS = 'oAEBogYBLg'

// A full load of the watch page embeds its player response, which YouTube
// builds from the `pp` query parameter.
export function noAdWatchUrl(url: string) {
  const parsed = new URL(url)
  if (parsed.pathname !== '/watch') {
    return null
  }
  parsed.searchParams.set('pp', NO_AD_PLAYER_PARAMS)
  return parsed.href
}

// In-page navigation requests the player response from /player, or from
// /get_watch as `playerRequest`. The body may be gzipped by the page.
export function noAdPlayerRequestBody(endpoint: string, body: Uint8Array, contentEncoding: string | null) {
  const gzipped = contentEncoding === 'gzip' || (body[0] === 0x1f && body[1] === 0x8b)
  const data = JSON.parse(new TextDecoder().decode(gzipped ? gunzipSync(body) : body))
  const playerRequest = endpoint === 'get_watch' ? data.playerRequest : data
  if (!playerRequest || typeof playerRequest !== 'object') {
    return null
  }
  playerRequest.params = NO_AD_PLAYER_PARAMS
  return JSON.stringify(data)
}
