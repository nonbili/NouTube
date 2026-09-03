import { batch } from '@legendapp/state'
import { auth$ } from '@/states/auth'
import { blocklist$, getBlocklistSnapshot } from '@/states/blocklist'
import { bookmarks$ } from '@/states/bookmarks'
import { feeds$ } from '@/states/feeds'
import { folders$ } from '@/states/folders'
import { getSettingsSnapshot, settings$ } from '@/states/settings'
import { syncMeta$ } from '@/states/sync-meta'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import type { Bookmark } from '@/states/bookmarks'
import { loadStoredState, saveStoredState, type StoredState } from './store'

/*
 * The app's observables are the working copy in every context; this module is
 * what makes them durable in an extension. Hydration is explicit rather than a
 * persist plugin, so the background can be sure the state is in place before it
 * lets a syncer decide what is newer than what.
 */

const reviveDate = (value: unknown) => (value instanceof Date ? value : new Date((value as string) || 0))

const reviveBookmark = (bookmark: Bookmark): Bookmark => ({
  ...bookmark,
  created_at: reviveDate(bookmark.created_at),
  updated_at: reviveDate(bookmark.updated_at),
})

export async function hydrateAppState() {
  const stored = await loadStoredState()

  batch(() => {
    settings$.assign(stored.settings)
    blocklist$.assign(stored.blocklist)
    userStyles$.assign(stored.userStyles)
    bookmarks$.assign({
      bookmarks: stored.bookmarks.items.map(reviveBookmark),
      updatedAt: reviveDate(stored.bookmarks.updatedAt),
    })
    folders$.assign({
      folders: stored.folders.items.map((folder) => ({
        ...folder,
        created_at: reviveDate(folder.created_at),
        updated_at: reviveDate(folder.updated_at),
      })),
      updatedAt: reviveDate(stored.folders.updatedAt),
    })
    feeds$.assign({
      feeds: stored.feeds.feeds.map((feed) => ({ id: feed.id, fetchedAt: reviveDate(feed.fetchedAt) })),
      bookmarks: stored.feeds.bookmarks.map(reviveBookmark),
    })
    syncMeta$.assign(stored.syncMeta as never)
    auth$.assign({ loaded: stored.auth.loaded, userId: stored.auth.userId, plan: stored.auth.plan })
  })

  return stored
}

const toIso = (value: unknown) => reviveDate(value).toISOString()

export const snapshotStoredState = (): Omit<StoredState, 'auth'> => ({
  settings: getSettingsSnapshot(),
  blocklist: getBlocklistSnapshot(),
  userStyles: getUserStylesSnapshot(),
  bookmarks: { items: bookmarks$.bookmarks.get(), updatedAt: toIso(bookmarks$.updatedAt.get()) },
  folders: { items: folders$.folders.get(), updatedAt: toIso(folders$.updatedAt.get()) },
  feeds: {
    feeds: feeds$.feeds.get().map((feed) => ({ id: feed.id, fetchedAt: toIso(feed.fetchedAt) })),
    bookmarks: feeds$.bookmarks.get(),
  },
  syncMeta: syncMeta$.get() as unknown as Record<string, unknown>,
})

/*
 * One debounced write per burst of observable changes. Every key is written
 * together: `browser.storage.local.set` is atomic per call, and the content
 * scripts wake on `onChanged` regardless of which key moved.
 */
export function persistAppStateOnChange(onPersisted?: () => void, delayMs = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const commit = () => {
    timer = undefined
    void saveStoredState(JSON.parse(JSON.stringify(snapshotStoredState()))).then(() => onPersisted?.())
  }

  const schedule = () => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(commit, delayMs)
  }

  const subscriptions = [
    settings$.onChange(schedule),
    blocklist$.onChange(schedule),
    userStyles$.onChange(schedule),
    bookmarks$.bookmarks.onChange(schedule),
    bookmarks$.updatedAt.onChange(schedule),
    folders$.folders.onChange(schedule),
    folders$.updatedAt.onChange(schedule),
    feeds$.feeds.onChange(schedule),
    feeds$.bookmarks.onChange(schedule),
    syncMeta$.onChange(schedule),
  ]

  return () => {
    if (timer) {
      clearTimeout(timer)
    }
    subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}
