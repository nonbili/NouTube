export type PlaylistDirection = 'previous' | 'next'

const getVideoId = (entry: any): string | undefined => entry?.playlistPanelVideoRenderer?.videoId

/** The active playlist, including Android's desktop-site layout. */
export function getPlayingPlaylist(response: any, playingVideoId?: string): any | undefined {
  if (!playingVideoId) return
  const contents = response?.contents
  for (const layout of [contents?.singleColumnWatchNextResults, contents?.twoColumnWatchNextResults]) {
    const playlist = layout?.playlist?.playlist
    if (Array.isArray(playlist?.contents) && playlist.contents.some((entry: any) =>
      entry?.playlistPanelVideoRenderer?.selected && getVideoId(entry) === playingVideoId,
    )) return playlist
  }
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
 * Returns undefined when the playlist is not about `playingVideoId`, or when
 * it has nothing in that direction.
 */
export function getPlaylistNeighborUrl(
  data: any,
  direction: PlaylistDirection,
  playingVideoId?: string,
): string | undefined {
  const contents: any[] = Array.isArray(data?.contents) ? data.contents : []
  const selectedIndex = contents.findIndex((x) => x?.playlistPanelVideoRenderer?.selected)
  const selectedId = getVideoId(contents[selectedIndex])
  // Guards against a response that is not the playing video's.
  if (!selectedId || (playingVideoId && playingVideoId != selectedId)) return

  // YouTube's own skip buttons, which also follow shuffle and loop.
  const button = direction == 'next' ? data.nextButtonVideo : data.previousButtonVideo
  const command = button?.buttonRenderer?.command
  if (command?.watchEndpoint?.videoId != selectedId) {
    const url = getEndpointUrl(command, data.playlistId)
    if (url) return url
  }

  const neighbor = contents[selectedIndex + (direction == 'next' ? 1 : -1)]?.playlistPanelVideoRenderer
  if (!neighbor?.videoId) return
  return (
    getEndpointUrl(neighbor.navigationEndpoint, data.playlistId) ||
    getEndpointUrl({ watchEndpoint: { videoId: neighbor.videoId } }, data.playlistId)
  )
}
