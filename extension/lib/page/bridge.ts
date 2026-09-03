import {
  bridgeReadyEvent,
  bridgeStateEvent,
  contentSettingsKey,
  decodeBridgePayload,
  preludeCacheKey,
  type BridgePayload,
} from '../bridge-protocol'
import { readCache } from './prelude'

const writeCache = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/* `NouTube.hideShorts` appends a fresh <style> every call and needs a head to
 * append it to, so the toggle is made idempotent and deferred here. */
function applyShorts(hide: boolean) {
  const run = () => {
    const nou = window.NouTube
    if (!nou) {
      return
    }
    if (!hide) {
      nou.showShorts()
      return
    }
    if (document.querySelector('style#noutube-shorts')) {
      nou.shortsHidden = true
    } else {
      nou.hideShorts()
    }
  }

  if (document.head) {
    run()
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  }
}

export function applyPayload(payload: BridgePayload) {
  const nou = window.NouTube
  const previousSettings = nou?.getSettings?.()
  // The same two writes the shells make: `content/player.ts` and friends read
  // the settings straight back out of localStorage.
  writeCache(contentSettingsKey, payload.settings)
  writeCache(preludeCacheKey, payload)
  nou?.setSettings?.(payload.settings)
  nou?.setBlocklist?.(payload.blocklist)
  nou?.setUserStyles?.(payload.userStyles)
  if (previousSettings?.playbackRate !== payload.settings.playbackRate) {
    nou?.setPlaybackRate?.(payload.settings.playbackRate)
  }
  if (previousSettings?.playbackQuality !== payload.settings.playbackQuality) {
    nou?.setPlaybackQuality?.(payload.settings.playbackQuality)
  }
  applyShorts(payload.hideShorts)
}

export function attachBridge() {
  // Search results are filtered against `shortsHidden` rather than the CSS, so
  // it has to hold the cached answer until the real payload lands.
  const cache = readCache<BridgePayload>(preludeCacheKey)
  if (window.NouTube) {
    window.NouTube.shortsHidden = cache.hideShorts === true
  }

  window.addEventListener(bridgeStateEvent, (event) => {
    const payload = decodeBridgePayload((event as CustomEvent).detail)
    if (payload) {
      applyPayload(payload)
    }
  })

  // The isolated half may have finished its storage read before this listener
  // existed; this asks it to send the payload again.
  window.dispatchEvent(new CustomEvent(bridgeReadyEvent))
}
