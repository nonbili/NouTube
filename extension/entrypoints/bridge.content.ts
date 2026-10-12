import { defineContentScript } from 'wxt/utils/define-content-script'
import { browser } from 'wxt/browser'
import { bridgeReadyEvent, bridgeStateEvent, encodeBridgePayload, type BridgePayload } from '../lib/bridge-protocol'
import { isYouTubeEmbed, YOUTUBE_EMBED_MATCHES, YOUTUBE_MATCHES } from '../lib/hosts'
import { normalizeBlocklist } from '@/lib/blocklist'
import { normalizeUserStyles } from '@/lib/user-styles'
import type { SettingsSnapshot } from '@/states/settings'
import { getClickbaitThumbnail, getContentSettings, getHideShorts, getPreferH264 } from '../lib/content-settings'

/*
 * Reads the three keys the page needs straight out of storage. The background
 * owns them; nothing here writes, and nothing here imports the app's stores.
 */
async function readPayload(): Promise<BridgePayload> {
  const stored = (await browser.storage.local.get(['settings', 'blocklist', 'userStyles'])) as {
    settings?: Partial<SettingsSnapshot>
  } & Record<string, unknown>
  const settings = stored.settings
  return {
    settings: getContentSettings(settings),
    blocklist: normalizeBlocklist(stored.blocklist as never),
    userStyles: normalizeUserStyles(stored.userStyles as never),
    hideShorts: getHideShorts(settings),
    preferH264: getPreferH264(settings),
    clickbaitThumbnail: getClickbaitThumbnail(settings),
  }
}

export default defineContentScript({
  // The embed patterns only add youtube-nocookie.com to the hosts above.
  matches: [...YOUTUBE_MATCHES, ...YOUTUBE_EMBED_MATCHES],
  runAt: 'document_start',
  allFrames: true,
  main() {
    // Only the frames the page half boots in: the top one and embedded players.
    if (window !== window.top && !isYouTubeEmbed(location.href)) {
      return
    }

    let latest: BridgePayload | undefined

    const send = (payload: BridgePayload) => {
      latest = payload
      window.dispatchEvent(new CustomEvent(bridgeStateEvent, { detail: encodeBridgePayload(payload) }))
    }

    // Registered before the first await: the page half announces itself as soon
    // as it has booted, which can be either side of the storage read below.
    window.addEventListener(bridgeReadyEvent, () => {
      if (latest) {
        send(latest)
      }
    })

    const push = () => void readPayload().then(send)

    push()
    // The background is the only writer, and every write lands here.
    browser.storage.onChanged.addListener((_changes, areaName) => {
      if (areaName === 'local') {
        push()
      }
    })
  },
})
