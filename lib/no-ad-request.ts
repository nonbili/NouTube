// Same playback parameters used by uBlock's YouTube filters. Requesting an
// ad-free player avoids scheduling a pre-roll before response filtering runs.
export const NO_AD_PLAYER_PARAMS = 'oAEBogYBLg'

export function noAdWatchUrl(url: string, blockAds = true) {
  const parsed = new URL(url)
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(parsed.hostname) ||
      parsed.pathname !== '/watch') return null
  if (blockAds) parsed.searchParams.set('pp', NO_AD_PLAYER_PARAMS)
  else if (parsed.searchParams.get('pp') === NO_AD_PLAYER_PARAMS) parsed.searchParams.delete('pp')
  return parsed.href
}

export function noAdPlayerJson(endpoint: string, text: string) {
  const data = JSON.parse(text)
  const player = endpoint === 'get_watch' ? data?.playerRequest : data
  if (!player || typeof player !== 'object' || Array.isArray(player)) return null
  player.params = NO_AD_PLAYER_PARAMS
  return JSON.stringify(data)
}
