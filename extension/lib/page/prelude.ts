import { normalizeBlocklist } from '@/lib/blocklist'
import { normalizeUserStyles } from '@/lib/user-styles'
import { getContentSettings } from '../content-settings'
import { contentSettingsKey, preludeCacheKey, type BridgePayload } from '../bridge-protocol'
import { createTrustedTypesProxy } from './trusted-types'

/*
 * Runs before the content bundle is imported, standing in for the prelude the
 * Android and Electron shells evaluate ahead of it. The isolated half of the
 * bridge only reaches us after an async storage read, which is too late for
 * `intercept()`, h264ify and the clickbait thumbnails, so the last known
 * preferences are read back from the page's own localStorage instead.
 */

export const readCache = <T>(key: string): Partial<T> => {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as Partial<T>) : {}
  } catch {
    return {}
  }
}

const cache = readCache<BridgePayload>(preludeCacheKey)

/*
 * `content/utils.ts` creates a trusted types policy while it is being imported.
 * Firefox has no trusted types at all, and YouTube's CSP can reject the policy
 * name outright — either one would throw before a single feature is installed.
 */
const trustedTypes = window.trustedTypes as any
if (!trustedTypes) {
  Object.defineProperty(window, 'trustedTypes', {
    value: { createPolicy: (_name: string, rules: unknown) => rules },
    configurable: true,
  })
} else {
  Object.defineProperty(window, 'trustedTypes', {
    value: createTrustedTypesProxy(trustedTypes),
    configurable: true,
  })
}

window.isAndroid = false
window.NouTubeInitialSettings = {
  ...getContentSettings(undefined),
  ...readCache<Record<string, unknown>>(contentSettingsKey),
}
window.NouTubeBlocklist = normalizeBlocklist(cache.blocklist)
window.NouTubeUserStyles = normalizeUserStyles(cache.userStyles)
;(window as any).NouTubePreferH264 = cache.preferH264 === true
;(window as any).NouTubeClickbaitThumbnail = cache.clickbaitThumbnail || 'default'
