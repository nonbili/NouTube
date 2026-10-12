import { defineContentScript } from 'wxt/utils/define-content-script'
// Same import order contract as noutube.content.ts.
import '../lib/page/prelude'
import '@/content/main'
import { attachBridge } from '../lib/page/bridge'
import { YOUTUBE_EMBED_MATCHES } from '../lib/hosts'

/*
 * The embedded player on other sites. A separate entrypoint rather than
 * `allFrames` on noutube.content.ts, because the bundle boots as it is imported
 * and so cannot pick its frames at runtime: this keeps it out of YouTube's own
 * iframes (live chat and the like), which no shell has ever injected into.
 */
export default defineContentScript({
  matches: YOUTUBE_EMBED_MATCHES,
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: true,
  main() {
    attachBridge()
  },
})
