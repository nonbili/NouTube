import { batch } from '@legendapp/state'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { auth$ } from '@/states/auth'
import { blocklist$, getBlocklistSnapshot } from '@/states/blocklist'
import { bookmarks$ } from '@/states/bookmarks'
import { feeds$ } from '@/states/feeds'
import { folders$ } from '@/states/folders'
import { getSettingsSnapshot, settings$ } from '@/states/settings'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { request, type AppSnapshot } from '../../lib/messages'

/*
 * The app's components read and write the observables directly, so this page
 * keeps them as a projection of the background's durable state: snapshots are
 * applied downwards, and anything the user changes is committed back upwards.
 * A commit is skipped while a snapshot is being applied, and each domain is
 * fingerprinted so an unrelated edit never rewrites the rest.
 */
const reviveDate = (value: unknown) => (value instanceof Date ? value : new Date((value as string) || 0))

const reviveItems = <T extends { created_at: unknown; updated_at: unknown }>(items: T[]) =>
  items.map((item) => ({ ...item, created_at: reviveDate(item.created_at), updated_at: reviveDate(item.updated_at) }))

const print = (value: unknown) => JSON.stringify(value)

export function useProjection(snapshot: AppSnapshot | undefined, onError: (message: string) => void) {
  const applying = useRef(false)
  const fingerprints = useRef<Record<string, string>>({})
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    if (!snapshot) {
      return
    }
    applying.current = true
    batch(() => {
      settings$.assign(snapshot.settings)
      blocklist$.assign(snapshot.blocklist)
      userStyles$.assign(snapshot.userStyles)
      bookmarks$.assign({
        bookmarks: reviveItems(snapshot.bookmarks.items),
        updatedAt: reviveDate(snapshot.bookmarks.updatedAt),
      })
      folders$.assign({
        folders: reviveItems(snapshot.folders.items),
        updatedAt: reviveDate(snapshot.folders.updatedAt),
      })
      feeds$.assign({
        feeds: snapshot.feeds.feeds.map((feed) => ({ id: feed.id, fetchedAt: reviveDate(feed.fetchedAt) })),
        bookmarks: reviveItems(snapshot.feeds.bookmarks),
      })
      auth$.assign({ loaded: snapshot.auth.loaded, userId: snapshot.auth.userId, plan: snapshot.auth.plan })
    })

    fingerprints.current = {
      settings: print(getSettingsSnapshot()),
      blocklist: print(getBlocklistSnapshot()),
      userStyles: print(getUserStylesSnapshot()),
      bookmarks: print(bookmarks$.bookmarks.get()),
      folders: print(folders$.folders.get()),
      feedBookmarks: print(feeds$.bookmarks.get()),
    }
    setReady(true)

    queueMicrotask(() => {
      applying.current = false
    })
  }, [snapshot])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const commit = async () => {
      timer = undefined
      const next = {
        settings: print(getSettingsSnapshot()),
        blocklist: print(getBlocklistSnapshot()),
        userStyles: print(getUserStylesSnapshot()),
        bookmarks: print(bookmarks$.bookmarks.get()),
        folders: print(folders$.folders.get()),
        feedBookmarks: print(feeds$.bookmarks.get()),
      }

      const changed = Object.keys(next).filter((key) => next[key as keyof typeof next] !== fingerprints.current[key])
      if (!changed.length) {
        return
      }
      fingerprints.current = next

      try {
        for (const key of changed) {
          switch (key) {
            case 'settings':
              await request({ type: 'set-settings', settings: getSettingsSnapshot() })
              break
            case 'blocklist':
              await request({ type: 'set-blocklist', blocklist: getBlocklistSnapshot() })
              break
            case 'userStyles':
              await request({ type: 'set-user-styles', userStyles: getUserStylesSnapshot() })
              break
            case 'bookmarks':
              await request({
                type: 'set-bookmarks',
                bookmarks: {
                  items: bookmarks$.bookmarks.get(),
                  updatedAt: reviveDate(bookmarks$.updatedAt.get()).toISOString(),
                },
              })
              break
            case 'folders':
              await request({
                type: 'set-folders',
                folders: { items: folders$.folders.get(), updatedAt: reviveDate(folders$.updatedAt.get()).toISOString() },
              })
              break
            case 'feedBookmarks':
              await request({ type: 'set-feed-bookmarks', bookmarks: feeds$.bookmarks.get() })
              break
          }
        }
      } catch (reason) {
        onError(reason instanceof Error ? reason.message : String(reason))
      }
    }

    const schedule = () => {
      if (applying.current) {
        return
      }
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => void commit(), 200)
    }

    const subscriptions = [
      settings$.onChange(schedule),
      blocklist$.onChange(schedule),
      userStyles$.onChange(schedule),
      bookmarks$.bookmarks.onChange(schedule),
      folders$.folders.onChange(schedule),
      feeds$.bookmarks.onChange(schedule),
    ]

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [onError])

  return ready
}
