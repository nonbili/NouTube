import { browser } from 'wxt/browser'
import { batch } from '@legendapp/state'
import { auth$ } from '@/states/auth'
import { blocklist$ } from '@/states/blocklist'
import { bookmarks$ } from '@/states/bookmarks'
import { feeds$ } from '@/states/feeds'
import { folders$ } from '@/states/folders'
import { settings$, getSettingsSnapshot } from '@/states/settings'
import { newBookmark } from '@/states/bookmarks'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { feederLoop, refreshChannelFeed } from '@/lib/feeder'
import { getPageType, getThumbnail } from '@/lib/page'
import { normalizeUrl } from '@/lib/url'
import { fetchYouTubeChannelMetadata } from '@/lib/youtube-channel'
import { bookmarksSyncer } from '@/lib/supabase/sync/bookmarks'
import { foldersSyncer } from '@/lib/supabase/sync/folders'
import { settingsSyncer } from '@/lib/supabase/sync/settings'
import { userStylesSyncer } from '@/lib/supabase/sync/user-styles'
import { restoreSession, signIn, signOut, watchSession } from './auth'
import { hydrateAppState, persistAppStateOnChange, snapshotStoredState } from './hydrate'
import { fetchFeedDirectly } from './main-client'
import { saveStoredState } from './store'
import { syncUserScripts, userScriptsAvailable } from '../user-scripts'
import { isSaveableBookmarkUrl } from '../context-menu'
import type { AppSnapshot, RequestMessage, ResponseMessage, StateChangedMessage } from '../messages'

export const SYNC_ALARM = 'noutube-sync'
export const FEED_ALARM = 'noutube-feeds'

let syncing = false
let syncError: string | undefined

const canSync = () => {
  const { userId, plan } = auth$.get()
  return Boolean(userId && plan && plan !== 'free')
}

const syncers = [bookmarksSyncer, foldersSyncer, settingsSyncer, userStylesSyncer]

export type AddBookmarkResult = 'added' | 'restored' | 'already-saved'

export async function addBookmarkFromUrl(url: string): Promise<AddBookmarkResult> {
  const pageType = getPageType(url)
  if (!pageType || !isSaveableBookmarkUrl(url)) {
    throw new Error('The selected link cannot be saved')
  }

  const normalizedUrl = normalizeUrl(url)
  const existing = bookmarks$.bookmarks.get().find((bookmark) => bookmark.url === normalizedUrl)
  if (existing && !existing.json.deleted) {
    return 'already-saved'
  }

  const metadata = await fetchYouTubeChannelMetadata(url, 1)
  const bookmark = newBookmark({
    ...existing,
    url: normalizedUrl,
    title: metadata.title || existing?.title || normalizedUrl,
    json: {
      ...existing?.json,
      id: pageType.type === 'channel' ? metadata.id || existing?.json.id : existing?.json.id,
      thumbnail: metadata.thumbnail || existing?.json.thumbnail || getThumbnail(normalizedUrl),
      deleted: false,
    },
  })
  bookmarks$.saveBookmark(bookmark)
  return existing ? 'restored' : 'added'
}

export async function syncNow() {
  if (!canSync() || syncing) {
    return
  }
  syncing = true
  syncError = undefined
  notifyStateChanged()
  try {
    await Promise.all(syncers.map((syncer) => syncer.syncNow()))
  } catch (error) {
    syncError = error instanceof Error ? error.message : String(error)
  } finally {
    syncing = false
    notifyStateChanged()
  }
}

/*
 * `@/lib/supabase/sync` wires the same listeners for the app, but it installs
 * them the moment it is imported — which here would be before hydration, so
 * loading the stored state would look like a local edit and mark every resource
 * dirty. Registering them after hydration keeps "dirty" meaning what it says.
 */
function watchLocalChanges() {
  const markAndSchedule = (syncer: (typeof syncers)[number]) => {
    if (syncer.isApplyingRemote()) {
      return
    }
    syncer.markDirty()
    if (canSync()) {
      syncer.scheduleSync()
    }
  }

  settings$.onChange(({ value, getPrevious }) => {
    const previous = getPrevious()
    if (!previous) {
      return
    }
    if (JSON.stringify(getSettingsSnapshot(value)) !== JSON.stringify(getSettingsSnapshot(previous))) {
      markAndSchedule(settingsSyncer)
    }
  })

  userStyles$.onChange(({ value, getPrevious }) => {
    const previous = getPrevious()
    if (!previous) {
      return
    }
    if (JSON.stringify(getUserStylesSnapshot(value)) !== JSON.stringify(getUserStylesSnapshot(previous))) {
      markAndSchedule(userStylesSyncer)
      void syncUserScripts(getUserStylesSnapshot(value))
    }
  })

  bookmarks$.bookmarks.onChange(() => {
    markAndSchedule(bookmarksSyncer)
    void feederLoop()
  })

  folders$.folders.onChange(() => markAndSchedule(foldersSyncer))
}

function notifyStateChanged() {
  const message: StateChangedMessage = { type: 'state-changed' }
  void browser.runtime.sendMessage(message).catch(() => undefined)
}

function snapshot(): AppSnapshot {
  const stored = snapshotStoredState()
  const { userId, plan } = auth$.get()
  return {
    ...stored,
    auth: { loaded: auth$.loaded.get(), userId, plan: plan || 'free' },
    syncing,
    syncError,
    userScripts: userScriptsAvailable() ? 'ready' : 'unavailable',
  }
}

export async function handle(message: RequestMessage): Promise<unknown> {
  switch (message.type) {
    case 'snapshot':
      return snapshot()
    case 'set-settings':
      settings$.assign(message.settings)
      return snapshot()
    case 'set-blocklist':
      blocklist$.assign(message.blocklist)
      return snapshot()
    case 'set-user-styles':
      userStyles$.assign(message.userStyles)
      return snapshot()
    case 'set-bookmarks':
      bookmarks$.assign({
        bookmarks: message.bookmarks.items,
        updatedAt: new Date(message.bookmarks.updatedAt),
      })
      return snapshot()
    case 'set-folders':
      folders$.assign({ folders: message.folders.items, updatedAt: new Date(message.folders.updatedAt) })
      return snapshot()
    case 'set-feed-bookmarks':
      feeds$.bookmarks.set(message.bookmarks)
      return snapshot()
    case 'sign-in': {
      const session = await signIn()
      await saveStoredState({
        auth: { loaded: true, userId: session?.user.id, email: session?.user.email, plan: auth$.plan.get() || 'free' },
      })
      await syncNow()
      return snapshot()
    }
    case 'sign-out':
      await signOut()
      await saveStoredState({ auth: { loaded: true, plan: 'free' } })
      return snapshot()
    case 'sync-now':
      await syncNow()
      return snapshot()
    case 'refresh-feeds':
      if (message.bookmarkId) {
        return refreshChannelFeed(message.bookmarkId)
      }
      await feederLoop()
      return snapshot()
    case 'noutube:fetch-feed':
      return fetchFeedDirectly(message.url)
    default:
      throw new Error(`Unknown message: ${(message as { type: string }).type}`)
  }
}


export async function start() {
  const stored = await hydrateAppState()
  batch(() => {
    auth$.assign({ loaded: stored.auth.loaded, userId: stored.auth.userId, plan: stored.auth.plan })
  })

  // Extension pages hold a projection of this state; a write is their cue to
  // re-read it, which is also how a finished feed run reaches an open tab.
  persistAppStateOnChange(notifyStateChanged)
  watchLocalChanges()
  watchSession()

  await browser.alarms.create(SYNC_ALARM, { periodInMinutes: 30 })
  await browser.alarms.create(FEED_ALARM, { periodInMinutes: 60 })

  void syncUserScripts(getUserStylesSnapshot())
  void restoreSession().then(async () => {
    notifyStateChanged()
    await syncNow()
    await feederLoop()
  })
}
