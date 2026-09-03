import { defineContentScript } from 'wxt/utils/define-content-script'
// Import order is the contract: the prelude publishes `window.NouTube*` and
// patches trusted types, and only then may the content bundle boot off them.
import '../lib/page/prelude'
import '@/content/main'
import { attachBridge } from '../lib/page/bridge'
import { YOUTUBE_MATCHES } from '../lib/hosts'

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  // The bundle reaches for `#movie_player`, `ytInitialData` and `fetch`, none of
  // which exist in an isolated world.
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: false,
  main() {
    attachBridge()
  },
})
