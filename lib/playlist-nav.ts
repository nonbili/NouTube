export type PlaylistDirection = 'previous' | 'next'

const getVideoId = (entry: any): string | undefined => entry?.playlistPanelVideoRenderer?.videoId

const getSelectedId = (playlist: any): string | undefined =>
  getVideoId(playlist?.contents?.find?.((entry: any) => entry?.playlistPanelVideoRenderer?.selected))

/** Whether the playlist was fetched for the playing video rather than for an earlier one. */
export const isPlaylistCurrent = (playlist: any, playingVideoId?: string) =>
  Boolean(playingVideoId) && getSelectedId(playlist) == playingVideoId

/** The playlists of a watch next response, including Android's desktop-site layout. */
function getPlaylists(response: any): any[] {
  const contents = response?.contents
  return [contents?.singleColumnWatchNextResults, contents?.twoColumnWatchNextResults]
    .map((layout) => layout?.playlist?.playlist)
    .filter((playlist) => Array.isArray(playlist?.contents))
}

/** The playlist of the player's watch next response, when that is about the playing video. */
export function getPlayingPlaylist(response: any, playingVideoId?: string): any | undefined {
  return getPlaylists(response).find((playlist) => isPlaylistCurrent(playlist, playingVideoId))
}

/**
 * The playlist `listId` out of responses that may be about an earlier video.
 *
 * YouTube sometimes moves on to the next video without fetching its watch next
 * response, mostly while the app is in the background, and every response the
 * page holds is then about an earlier video. Such a playlist still lists the
 * playing one. It lingers after the playlist was left too, so it only counts
 * while the page url still names it.
 */
export function getHeldPlaylist(responses: any[], playingVideoId?: string, listId?: string | null): any | undefined {
  if (!playingVideoId || !listId) return
  const playlists = responses
    .flatMap(getPlaylists)
    .filter((playlist) => playlist.playlistId == listId)
  return (
    playlists.find((playlist) => isPlaylistCurrent(playlist, playingVideoId)) ||
    playlists.find((playlist) => playlist.contents.some((entry: any) => getVideoId(entry) == playingVideoId))
  )
}

function getEndpointUrl(endpoint: any, playlistId?: string): string | undefined {
  const url = endpoint?.commandMetadata?.webCommandMetadata?.url
  if (typeof url == 'string' && url.includes('v=')) return url
  const videoId = endpoint?.watchEndpoint?.videoId
  if (!videoId) return
  const list = endpoint.watchEndpoint.playlistId || playlistId
  return `/watch?v=${videoId}${list ? `&list=${list}` : ''}`
}

/**
 * The url of the video before or after the playing one in a playlist, read
 * from the playlist of m.youtube.com's watch next response. The mobile player
 * does not know the playlist it is in, so its own next and previous leave it.
 *
 * Returns undefined when `playingVideoId` is not in the playlist, or when the
 * playlist has nothing in that direction.
 */
export function getPlaylistNeighborUrl(
  data: any,
  direction: PlaylistDirection,
  playingVideoId?: string,
): string | undefined {
  const contents: any[] = Array.isArray(data?.contents) ? data.contents : []
  const selectedId = getSelectedId(data)
  const playingId = playingVideoId || selectedId
  const current = Boolean(selectedId) && selectedId == playingId
  // A stale playlist has its selection on an earlier video.
  const playingIndex = contents.findIndex((x) =>
    current ? x?.playlistPanelVideoRenderer?.selected : getVideoId(x) == playingId,
  )
  if (!playingId || playingIndex < 0) return

  // YouTube's own skip buttons, which also follow shuffle and loop. They skip
  // from the selected video, so they only help while that is the playing one.
  const button = direction == 'next' ? data.nextButtonVideo : data.previousButtonVideo
  const command = button?.buttonRenderer?.command
  if (current && command?.watchEndpoint?.videoId != selectedId) {
    const url = getEndpointUrl(command, data.playlistId)
    if (url) return url
  }

  const neighbor = contents[playingIndex + (direction == 'next' ? 1 : -1)]?.playlistPanelVideoRenderer
  if (!neighbor?.videoId) return
  return (
    getEndpointUrl(neighbor.navigationEndpoint, data.playlistId) ||
    getEndpointUrl({ watchEndpoint: { videoId: neighbor.videoId } }, data.playlistId)
  )
}
