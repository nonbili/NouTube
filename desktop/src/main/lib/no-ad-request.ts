import { gunzipSync } from 'node:zlib'
import { noAdPlayerJson } from 'noutube/lib/no-ad-request'
export { NO_AD_PLAYER_PARAMS, noAdWatchUrl } from 'noutube/lib/no-ad-request'

// In-page navigation requests the player response from /player, or from
// /get_watch as `playerRequest`. The body may be gzipped by the page.
export function noAdPlayerRequestBody(endpoint: string, body: Uint8Array, contentEncoding: string | null) {
  const gzipped = contentEncoding === 'gzip' || (body[0] === 0x1f && body[1] === 0x8b)
  return noAdPlayerJson(endpoint, new TextDecoder().decode(gzipped ? gunzipSync(body) : body))
}
