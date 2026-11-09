import { describe, expect, it, mock } from 'bun:test'

mock.module('@/lib/feeder', () => ({ feederLoop: async () => {}, refreshChannelFeed: async () => 'ok' }))

const { getUserStylesSnapshot, userStyles$ } = await import('@/states/user-styles')
const { syncMeta$ } = await import('@/states/sync-meta')
const { userStylesSyncer } = await import('./user-styles')
const { watchLocalSyncChanges } = await import('./watch')

describe('watchLocalSyncChanges', () => {
  it('tells the extension about pulled user styles without taking them for a local edit', () => {
    const seen: boolean[] = []
    const stop = watchLocalSyncChanges({
      requireHydrated: false,
      onUserStylesChange: (value) => seen.push(value.builtins['hide-shorts-navbar'].enabled),
    })
    try {
      syncMeta$.userStyles.dirty.set(false)
      const current = getUserStylesSnapshot()
      const enabled = !current.builtins['hide-shorts-navbar'].enabled
      userStylesSyncer.applyRemote({
        ...current,
        builtins: { ...current.builtins, 'hide-shorts-navbar': { enabled } },
      })
      expect(seen).toEqual([enabled])
      expect(syncMeta$.userStyles.dirty.peek()).toBe(false)

      userStyles$.setBuiltinEnabled('hide-shorts-navbar', !enabled)
      expect(seen).toEqual([enabled, !enabled])
      expect(syncMeta$.userStyles.dirty.peek()).toBe(true)
    } finally {
      stop()
    }
  })
})
