import type { BlocklistSnapshot } from '@/lib/blocklist'
import type { UserStylesSnapshot } from '@/lib/user-styles'
import type { ContentSettings } from './state'

/*
 * The content bundle runs in the page's own world so it can reach
 * `#movie_player`, `ytInitialData` and `fetch`; extension APIs are only
 * reachable from the isolated world. The two halves talk over DOM events, and
 * the payload is a JSON string so nothing has to survive a structured clone
 * across worlds.
 */
export const bridgeStateEvent = 'noutube:extension:state'
export const bridgeReadyEvent = 'noutube:extension:ready'

/* Read synchronously at document start, before the content bundle boots: it is
 * the only way the page half can know last session's preferences in time for
 * `intercept()` and h264ify. */
export const preludeCacheKey = 'nou:extension'
export const contentSettingsKey = 'nou:settings'

export interface BridgePayload {
  settings: ContentSettings
  blocklist: BlocklistSnapshot
  userStyles: UserStylesSnapshot
  hideShorts: boolean
  preferH264: boolean
  clickbaitThumbnail: string
}

export const encodeBridgePayload = (payload: BridgePayload) => JSON.stringify(payload)

export const decodeBridgePayload = (detail: unknown): BridgePayload | null => {
  if (typeof detail !== 'string') {
    return null
  }
  try {
    return JSON.parse(detail) as BridgePayload
  } catch {
    return null
  }
}
