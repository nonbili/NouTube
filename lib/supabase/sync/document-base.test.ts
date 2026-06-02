import { beforeEach, describe, expect, it } from 'bun:test'
import { auth$ } from '@/states/auth'
import type { ResourceSyncMeta } from '@/states/sync-meta'
import { DocumentSyncer } from './document-base'

interface TestValue {
  enabled: boolean
  name?: string
}

const emptyMeta = (): ResourceSyncMeta<TestValue> => ({
  dirty: false,
  lastSyncedRemoteUpdatedAt: undefined,
  lastSuccessfulSyncAt: undefined,
  lastError: undefined,
  backup: undefined,
})

class TestDocumentSyncer extends DocumentSyncer<TestValue> {
  NAME = 'test-document'
  TABLE_NAME = 'test_documents'
  pushWhenRemoteMissing = true

  value: TestValue = { enabled: true }
  meta: ResourceSyncMeta<TestValue> = emptyMeta()
  remote: { value: TestValue; updatedAt: string } | null = null
  savedValues: TestValue[] = []
  appliedValues: TestValue[] = []

  isPersistLoaded() {
    return Promise.resolve(true)
  }

  getValue() {
    return this.value
  }

  setValue(value: TestValue) {
    this.appliedValues.push(value)
    this.value = value
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

  fetchRemote() {
    return Promise.resolve(this.remote)
  }

  saveRemote(value: TestValue) {
    this.savedValues.push(value)
    this.remote = {
      value,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }
    return Promise.resolve(this.remote)
  }
}

describe('DocumentSyncer', () => {
  beforeEach(() => {
    auth$.assign({
      loaded: true,
      userId: 'user-1',
      user: undefined,
      accessToken: '',
      plan: 'pro',
    })
  })

  it('pushes local value when remote row is missing', async () => {
    const syncer = new TestDocumentSyncer()
    syncer.value = { enabled: true, name: 'local' }

    await syncer.syncNow()

    expect(syncer.savedValues).toEqual([{ enabled: true, name: 'local' }])
    expect(syncer.appliedValues).toHaveLength(0)
    expect(syncer.meta.dirty).toBe(false)
    expect(syncer.meta.lastSyncedRemoteUpdatedAt).toBe('2026-03-16T00:00:00.000Z')
  })

  it('pulls newer remote value when local state is clean', async () => {
    const syncer = new TestDocumentSyncer()
    syncer.value = { enabled: true, name: 'local' }
    syncer.remote = {
      value: { enabled: false, name: 'remote' },
      updatedAt: '2026-03-16T00:00:00.000Z',
    }
    syncer.meta = {
      ...emptyMeta(),
      lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
    }

    await syncer.syncNow()

    expect(syncer.savedValues).toHaveLength(0)
    expect(syncer.appliedValues).toEqual([{ enabled: false, name: 'remote' }])
    expect(syncer.value).toEqual({ enabled: false, name: 'remote' })
    expect(syncer.meta.lastSyncedRemoteUpdatedAt).toBe('2026-03-16T00:00:00.000Z')
  })

  it('backs up local value before pulling divergent remote value', async () => {
    const syncer = new TestDocumentSyncer()
    syncer.value = { enabled: true, name: 'local' }
    syncer.remote = {
      value: { enabled: false, name: 'remote' },
      updatedAt: '2026-03-16T00:00:00.000Z',
    }
    syncer.meta = {
      ...emptyMeta(),
      dirty: true,
      lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
    }

    await syncer.syncNow()

    expect(syncer.savedValues).toHaveLength(0)
    expect(syncer.appliedValues).toEqual([{ enabled: false, name: 'remote' }])
    expect(syncer.meta.backup?.value).toEqual({ enabled: true, name: 'local' })
    expect(syncer.meta.backup?.remoteUpdatedAt).toBe('2026-03-16T00:00:00.000Z')
  })

  it('skips sync for a free user', async () => {
    auth$.plan.set('free')
    const syncer = new TestDocumentSyncer()

    await syncer.syncNow()

    expect(syncer.savedValues).toHaveLength(0)
    expect(syncer.appliedValues).toHaveLength(0)
    expect(syncer.meta).toEqual(emptyMeta())
  })
})
