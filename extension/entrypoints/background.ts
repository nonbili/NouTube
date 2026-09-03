import { defineBackground } from 'wxt/utils/define-background'
import { browser } from 'wxt/browser'
import { feederLoop } from '@/lib/feeder'
import { addBookmarkFromUrl, FEED_ALARM, handle, start, SYNC_ALARM, syncNow } from '../lib/app/background-core'
import { YOUTUBE_MATCHES } from '../lib/hosts'
import { SAVE_BOOKMARK_LINK_MATCHES } from '../lib/context-menu'

const ADD_VIDEO_BOOKMARK_MENU = 'noutube-add-video-bookmark'

const badgeTimers = new Map<number, ReturnType<typeof setTimeout>>()

const showBookmarkResult = async (tabId: number, text: string, color: string) => {
  const previousTimer = badgeTimers.get(tabId)
  if (previousTimer) {
    clearTimeout(previousTimer)
  }
  await Promise.all([
    browser.action.setBadgeText({ tabId, text }),
    browser.action.setBadgeBackgroundColor({ tabId, color }),
  ])
  badgeTimers.set(
    tabId,
    setTimeout(() => {
      badgeTimers.delete(tabId)
      void browser.action.setBadgeText({ tabId, text: '' })
    }, 2000),
  )
}

/*
 * Deliberately thin: WXT parses this file on its own to read the options above,
 * so the state machine lives in lib/app/background-core.ts instead.
 */
export default defineBackground(() => {
  const ready = start()

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: ADD_VIDEO_BOOKMARK_MENU,
      title: 'Save to NouTube',
      contexts: ['link'],
      documentUrlPatterns: YOUTUBE_MATCHES,
      targetUrlPatterns: SAVE_BOOKMARK_LINK_MATCHES,
    })
  })

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== ADD_VIDEO_BOOKMARK_MENU || !info.linkUrl) {
      return
    }
    void ready
      .then(() => addBookmarkFromUrl(info.linkUrl!))
      .then((result) => {
        if (tab?.id != null) {
          return showBookmarkResult(tab.id, result === 'already-saved' ? '=' : '✓', result === 'already-saved' ? '#71717a' : '#16a34a')
        }
      })
      .catch((error) => {
        console.error('Failed to save bookmark', error)
        if (tab?.id != null) {
          void showBookmarkResult(tab.id, '!', '#dc2626')
        }
      })
  })

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
