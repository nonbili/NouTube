import { beforeEach, describe, expect, it } from 'bun:test'
import { auth$ } from '@/states/auth'
import type { ResourceSyncMeta } from '@/states/sync-meta'
import { BaseSyncer } from './base'

interface TestItem {
  id: string
  json: { deleted?: boolean }
  created_at: Date
  updated_at: Date
}

const makeItem = (id: string, updatedAt: string, json: TestItem['json'] = {}): TestItem => ({
  id,
  json,
  created_at: new Date(updatedAt),
  updated_at: new Date(updatedAt),
})

const emptyMeta = (): ResourceSyncMeta<TestItem[]> => ({
  dirty: false,
  lastSyncedRemoteUpdatedAt: undefined,
  lastSuccessfulSyncAt: undefined,
  lastError: undefined,
  backup: undefined,
})

class TestSyncer extends BaseSyncer<TestItem> {
  NAME = 'test'
  TABLE_NAME = 'test_rows'
  COLUMNS = 'id,created_at,updated_at,json'
  pushWhenRemoteMissing = false

  store: { items: TestItem[]; updatedAt: Date } = {
    items: [],
    updatedAt: new Date(0),
  }
  meta: ResourceSyncMeta<TestItem[]> = emptyMeta()
  remoteItems: TestItem[] = []
  replacedStores: { items: TestItem[]; updatedAt: Date }[] = []
  savedCalls: TestItem[][] = []
  deletedCalls: TestItem[][] = []

  isPersistLoaded() {
    return Promise.resolve(true)
  }

  getStore() {
    return this.store
  }

  setStore(data: { items: TestItem[]; updatedAt: Date }) {
    this.replacedStores.push(data)
    this.store = data
  }

  getMeta() {
    return this.meta
  }

  setMeta(meta: Partial<ResourceSyncMeta<TestItem[]>>) {
    this.meta = { ...this.meta, ...meta }
  }

  hasMeaningfulLocalValue(items: TestItem[]) {
    return items.some((item) => !item.json.deleted)
  }

  fetchItems() {
    return Promise.resolve(this.remoteItems)
  }

  saveItems(items: TestItem[]) {
    if (!items.length) {
      return Promise.resolve()
    }

    this.savedCalls.push(items)
    return Promise.resolve()
  }

  deleteItems(items: TestItem[]) {
    if (!items.length) {
      return Promise.resolve()
    }

    this.deletedCalls.push(items)
    return Promise.resolve()
  }
}

describe('BaseSyncer push path', () => {
  beforeEach(() => {
    auth$.assign({
      loaded: true,
      userId: 'user-1',
      user: undefined,
      accessToken: '',
      plan: 'pro',
    })
  })

  it('pushes only local rows changed since the last sync', async () => {
    const syncer = new TestSyncer()
    syncer.store = {
      items: [
        makeItem('unchanged', '2026-03-15T00:00:00.000Z'),
        makeItem('changed', '2026-03-16T00:00:00.000Z'),
        makeItem('deleted', '2026-03-16T01:00:00.000Z', { deleted: true }),
      ],
      updatedAt: new Date('2026-03-16T01:00:00.000Z'),
    }
    syncer.remoteItems = [makeItem('remote', '2026-03-15T00:00:00.000Z')]
    syncer.meta = {
      ...emptyMeta(),
      dirty: true,
      lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
    }

    await syncer.syncNow()

    expect(syncer.savedCalls).toHaveLength(1)
    expect(syncer.savedCalls[0].map((item) => item.id)).toEqual(['changed'])
    expect(syncer.deletedCalls).toHaveLength(1)
    expect(syncer.deletedCalls[0].map((item) => item.id)).toEqual(['deleted'])
    expect(syncer.replacedStores).toHaveLength(0)
    expect(syncer.meta.dirty).toBe(false)
    expect(syncer.meta.lastSyncedRemoteUpdatedAt).toBe('2026-03-16T01:00:00.000Z')
  })

  it('advances the remote timestamp for a delete-only push so other devices can pull the tombstone', async () => {
    const syncer = new TestSyncer()
    syncer.store = {
      items: [
        makeItem('remaining', '2026-03-15T00:00:00.000Z'),
        makeItem('deleted', '2026-03-16T00:00:00.000Z', { deleted: true }),
      ],
      updatedAt: new Date('2026-03-16T00:00:00.000Z'),
    }
    syncer.remoteItems = [makeItem('remote', '2026-03-15T00:00:00.000Z')]
    syncer.meta = {
      ...emptyMeta(),
      dirty: true,
      lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
    }

    await syncer.syncNow()

    expect(syncer.savedCalls).toHaveLength(0)
    expect(syncer.deletedCalls).toHaveLength(1)
    expect(syncer.deletedCalls[0].map((item) => item.id)).toEqual(['deleted'])
    expect(syncer.meta.lastSyncedRemoteUpdatedAt).toBe('2026-03-16T00:00:00.000Z')
  })

  it('pulls remote rows when the collection changed without a newer remote timestamp', async () => {
    const syncer = new TestSyncer()
    syncer.store = {
      items: [
        makeItem('newer', '2026-03-16T00:00:00.000Z'),
        makeItem('stale-local', '2026-03-15T00:00:00.000Z'),
      ],
      updatedAt: new Date('2026-03-16T00:00:00.000Z'),
    }
    syncer.remoteItems = [makeItem('newer', '2026-03-16T00:00:00.000Z')]
    syncer.meta = {
      ...emptyMeta(),
      dirty: false,
      lastSyncedRemoteUpdatedAt: '2026-03-16T00:00:00.000Z',
    }

    await syncer.syncNow()

    expect(syncer.savedCalls).toHaveLength(0)
    expect(syncer.deletedCalls).toHaveLength(0)
    expect(syncer.replacedStores).toHaveLength(1)
    expect(syncer.store.items.map((item) => item.id)).toEqual(['newer'])
    expect(syncer.meta.lastSyncedRemoteUpdatedAt).toBe('2026-03-16T00:00:00.000Z')
  })
})
