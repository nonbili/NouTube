import { defineBackground } from 'wxt/utils/define-background'
import { browser } from 'wxt/browser'
import { feederLoop } from '@/lib/feeder'
import { FEED_ALARM, handle, start, SYNC_ALARM, syncNow } from '../lib/app/background-core'

/*
 * Deliberately thin: WXT parses this file on its own to read the options above,
 * so the state machine lives in lib/app/background-core.ts instead.
 */
export default defineBackground(() => {
  const ready = start()

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void ready
      .then(() => handle(message))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    // Keeps the message channel open for the async reply above.
    return true
  })

  browser.alarms.onAlarm.addListener((alarm) => {
    void ready.then(() => {
      if (alarm.name === SYNC_ALARM) {
        void syncNow()
      }
      if (alarm.name === FEED_ALARM) {
        void feederLoop()
      }
    })
  })
})
