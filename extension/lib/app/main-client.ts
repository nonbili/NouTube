import { browser } from 'wxt/browser'

/*
 * Replaces `@/lib/main-client`, the Electron IPC proxy. Only the feed fetch is
 * meaningful here: the background holds the youtube.com host permission, so it
 * can read the RSS feeds that a page's fetch would be refused by CORS. Every
 * other main-process call belongs to the desktop shell and has no counterpart.
 */
export interface FetchFeedResult {
  ok: boolean
  status: number
  statusText: string
  body: string
}

export const fetchFeedMessage = 'noutube:fetch-feed'

/* Loose by design: the app calls main-process methods this build has no answer
 * for, and they should fail where they are called, not where they are typed. */
export interface ExtensionMainClient {
  fetchFeed: (url: string) => Promise<FetchFeedResult>
  [name: string]: (...args: any[]) => Promise<any>
}

export async function fetchFeedDirectly(url: string): Promise<FetchFeedResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return { ok: res.ok, status: res.status, statusText: res.statusText, body: await res.text() }
  } finally {
    clearTimeout(timeout)
  }
}

const fetchFeed = (url: string): Promise<FetchFeedResult> =>
  // Extension pages hand the request to the background; the background already
  // is the privileged context and fetches directly.
  typeof document === 'undefined'
    ? fetchFeedDirectly(url)
    : (browser.runtime.sendMessage({ type: fetchFeedMessage, url }) as Promise<FetchFeedResult>)

export const mainClient = new Proxy({} as ExtensionMainClient, {
  get(_target, name) {
    if (name === 'fetchFeed') {
      return fetchFeed
    }
    return async () => {
      throw new Error(`main process call "${String(name)}" is not available in the extension`)
    }
  },
})
