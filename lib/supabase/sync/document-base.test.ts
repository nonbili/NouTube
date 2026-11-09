import { beforeEach, describe, expect, it } from 'bun:test'
import { auth$ } from '@/states/auth'
import { syncMeta$, type ResourceSyncMeta } from '@/states/sync-meta'
import { DocumentSyncer } from './document-base'
import { mergeKeys } from './merge'

interface TestValue {
  enabled: boolean
  name?: string
}

const emptyMeta = (): ResourceSyncMeta<TestValue> => ({ dirty: false })

/** One row, written only on top of the copy a device read, as nou_put_doc does. */
class FakeServer {
  row: { value: TestValue; updatedAt: string } | null = null
  clock = 0
  writes: TestValue[] = []
  // Runs before a write lands, as another device writing first.
  beforeWrite?: () => void

  put(value: TestValue) {
    this.row = { value: structuredClone(value), updatedAt: `2026-11-09T00:00:${String(this.clock++).padStart(2, '0')}.000Z` }
  }
}

class TestDocumentSyncer extends DocumentSyncer<TestValue> {
  NAME = 'test-document'
  TABLE_NAME = 'test_documents'
  pushWhenRemoteMissing = true

  value: TestValue = { enabled: true }
  meta: ResourceSyncMeta<TestValue> = emptyMeta()

  constructor(private server: FakeServer) {
    super()
  }

  isPersistLoaded() {
    return Promise.resolve(true)
  }

  getValue() {
    return this.value
  }

  setValue(value: TestValue) {
    this.value = value
  }

  merge(base: TestValue | undefined, local: TestValue, remote: TestValue) {
    return mergeKeys(base, local, remote)
  }

  hasMeaningfulLocalValue() {
    return true
  }

  getMeta() {
    return this.meta
  }

  setMeta(meta: Partial<ResourceSyncMeta<TestValue>>) {
    this.meta = { ...this.meta, ...meta }
  }

  async fetchRemote() {
    return this.server.row && structuredClone(this.server.row)
  }

  protected async saveRemote(_userId: string, value: TestValue, base: string | undefined) {
    this.server.beforeWrite?.()
    this.server.beforeWrite = undefined
    if ((this.server.row?.updatedAt ?? undefined) !== base) {
      return { ok: false, updatedAt: this.server.row?.updatedAt }
    }
    this.server.writes.push(structuredClone(value))
    this.server.put(value)
    return { ok: true, updatedAt: this.server.row!.updatedAt }
  }

  /** A change made here, as the store's listener sees it. */
  edit(value: TestValue) {
    this.value = value
    this.markDirty()
  }
}

describe('DocumentSyncer', () => {
  let server: FakeServer

  beforeEach(() => {
    server = new FakeServer()
    syncMeta$.ownerUserId.set(undefined)
    auth$.assign({ loaded: true, userId: 'user-1', user: undefined, accessToken: '', plan: 'pro' })
  })

  it('pushes the value here when the account has none', async () => {
    const device = new TestDocumentSyncer(server)
    device.value = { enabled: true, name: 'local' }

    await device.syncNow()

    expect(server.writes).toEqual([{ enabled: true, name: 'local' }])
    expect(device.meta.dirty).toBe(false)
    expect(device.meta.lastSyncedRemoteUpdatedAt).toBe(server.row!.updatedAt)
    expect(device.meta.base).toEqual({ enabled: true, name: 'local' })
  })

  it('pulls a newer value when nothing changed here', async () => {
    server.put({ enabled: false, name: 'remote' })
    const device = new TestDocumentSyncer(server)
    device.meta = { ...emptyMeta(), lastSyncedRemoteUpdatedAt: 'older' }

    await device.syncNow()

    expect(server.writes).toEqual([])
    expect(device.value).toEqual({ enabled: false, name: 'remote' })
  })

  it('merges changes two devices made to different settings', async () => {
    const a = new TestDocumentSyncer(server)
    const b = new TestDocumentSyncer(server)
    a.value = { enabled: true, name: 'start' }
    await a.syncNow()
    await b.syncNow()

    a.edit({ ...a.value, enabled: false })
    b.edit({ ...b.value, name: 'renamed' })
    await a.syncNow()
    await b.syncNow()
    await a.syncNow()

    expect(server.row?.value).toEqual({ enabled: false, name: 'renamed' })
    expect(a.value).toEqual({ enabled: false, name: 'renamed' })
    expect(b.value).toEqual({ enabled: false, name: 'renamed' })
    expect(b.meta.backup).toBeUndefined()
  })

  it('takes the other device when both changed the same setting, and keeps a backup', async () => {
    server.put({ enabled: true, name: 'start' })
    const device = new TestDocumentSyncer(server)
    await device.syncNow()
    server.put({ enabled: true, name: 'theirs' })

    device.edit({ enabled: true, name: 'mine' })
    await device.syncNow()

    expect(device.value).toEqual({ enabled: true, name: 'theirs' })
    expect(device.meta.backup?.value).toEqual({ enabled: true, name: 'mine' })

    device.restoreBackup()
    // The store's listener takes the restored value for a change made here.
    device.markDirty()
    await device.syncNow()
    expect(server.row?.value).toEqual({ enabled: true, name: 'mine' })
  })

  it('merges again when another device wrote between the read and the write', async () => {
    server.put({ enabled: true, name: 'start' })
    const device = new TestDocumentSyncer(server)
    await device.syncNow()

    device.edit({ enabled: false, name: 'start' })
    server.beforeWrite = () => server.put({ enabled: true, name: 'renamed meanwhile' })
    await device.syncNow()

    expect(server.row?.value).toEqual({ enabled: false, name: 'renamed meanwhile' })
    expect(device.value).toEqual({ enabled: false, name: 'renamed meanwhile' })
  })

  it('keeps the row as the base on a clean sync after the upgrade, so later changes merge', async () => {
    server.put({ enabled: true, name: 'start' })
    const a = new TestDocumentSyncer(server)
    const b = new TestDocumentSyncer(server)
    // Synced by the old version: in step with the row, without a base.
    for (const device of [a, b]) {
      device.value = { enabled: true, name: 'start' }
      device.meta = { ...emptyMeta(), lastSyncedRemoteUpdatedAt: server.row!.updatedAt }
    }
    await a.syncNow()
    await b.syncNow()
    expect(b.meta.base).toEqual({ enabled: true, name: 'start' })

    a.edit({ enabled: false, name: 'start' })
    await a.syncNow()
    b.edit({ enabled: true, name: 'renamed' })
    await b.syncNow()

    expect(server.row?.value).toEqual({ enabled: false, name: 'renamed' })
    expect(b.meta.backup).toBeUndefined()
  })

  it('skips sync for a free user', async () => {
    auth$.plan.set('free')
    const device = new TestDocumentSyncer(server)

    await device.syncNow()

    expect(server.writes).toEqual([])
    expect(device.meta).toEqual(emptyMeta())
  })
})
