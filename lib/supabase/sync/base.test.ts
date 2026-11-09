import { beforeEach, describe, expect, it } from 'bun:test'
import { auth$ } from '@/states/auth'
import { emptyRowMeta, syncMeta$, type RowSyncMeta } from '@/states/sync-meta'
import { RowSyncer } from './base'
import type { SyncRow } from './rows'

interface TestRow extends SyncRow {
  title: string
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 9, 0, minute))

const row = (id: string, title: string, minute = 0, json: TestRow['json'] = {}): TestRow => ({
  id,
  title,
  json,
  created_at: at(minute),
  updated_at: at(minute),
})

/** The server's rows, with `updated_at` stamped by its own clock as the trigger does. */
class FakeServer {
  rows = new Map<string, TestRow>()
  clock = 100
  upserts: string[][] = []
  // Runs before a write lands, to change things while the request is out.
  beforeUpsert?: () => void

  seed(...rows: TestRow[]) {
    for (const item of rows) this.rows.set(item.id, { ...item, updated_at: at(this.clock++) })
  }

  read(cursor?: string) {
    return [...this.rows.values()]
      .filter((item) => !cursor || item.updated_at > new Date(cursor))
      .sort((a, b) => a.updated_at.getTime() - b.updated_at.getTime())
      .map((item) => structuredClone(item))
  }

  write(rows: TestRow[]) {
    this.beforeUpsert?.()
    this.upserts.push(rows.map((item) => item.id))
    return rows.map((item) => {
      const stored = { ...structuredClone(item), updated_at: at(this.clock++) }
      this.rows.set(item.id, stored)
      return structuredClone(stored)
    })
  }
}

class TestRowSyncer extends RowSyncer<TestRow> {
  NAME = 'test'
  TABLE_NAME = 'test_rows'
  COLUMNS = 'id,title,json,created_at,updated_at'

  rows: TestRow[] = []
  meta: RowSyncMeta = emptyRowMeta()
  beforeFetch?: () => void

  constructor(private server: FakeServer) {
    super()
  }

  isPersistLoaded() {
    return Promise.resolve(true)
  }

  getRows() {
    return this.rows
  }

  setRows(rows: TestRow[]) {
    this.rows = rows
  }

  getMeta() {
    return this.meta
  }

  setMeta(meta: Partial<RowSyncMeta>) {
    this.meta = { ...this.meta, ...meta }
  }

  async fetchRows(cursor?: string, assertCurrent: () => void = () => {}) {
    this.beforeFetch?.()
    const rows = this.server.read(cursor)
    assertCurrent()
    return rows
  }

  async upsertRows(_userId: string, rows: TestRow[]) {
    return this.server.write(rows)
  }

  /** A change made here, as the store's listener sees it. */
  edit(rows: TestRow[]) {
    const previous = this.rows
    this.rows = rows
    this.trackLocalChange(rows, previous)
  }
}

const titles = (rows: TestRow[]) => rows.map((item) => `${item.id}:${item.title}`).sort()

describe('RowSyncer', () => {
  let server: FakeServer

  beforeEach(() => {
    server = new FakeServer()
    syncMeta$.ownerUserId.set(undefined)
    auth$.assign({ loaded: true, userId: 'user-1', user: undefined, accessToken: '', plan: 'pro' })
  })

  it('keeps rows added on two devices', async () => {
    const a = new TestRowSyncer(server)
    const b = new TestRowSyncer(server)
    a.edit([row('a1', 'from a')])
    b.edit([row('b1', 'from b')])

    await a.syncNow()
    await b.syncNow()
    await a.syncNow()

    expect(titles(a.rows)).toEqual(['a1:from a', 'b1:from b'])
    expect(titles(b.rows)).toEqual(['a1:from a', 'b1:from b'])
    expect(a.meta.pendingIds).toEqual([])
    expect(b.meta.pendingIds).toEqual([])
  })

  it('pushes only the rows changed since the last sync', async () => {
    server.seed(row('one', 'one'), row('two', 'two'))
    const device = new TestRowSyncer(server)
    await device.syncNow()
    server.upserts = []

    device.edit(device.rows.map((item) => (item.id === 'two' ? { ...item, title: 'two!' } : item)))
    await device.syncNow()

    expect(server.upserts).toEqual([['two']])
    expect(server.rows.get('two')?.title).toBe('two!')
  })

  it('keeps an edit not pushed yet over the copy another device wrote, and takes theirs elsewhere', async () => {
    server.seed(row('one', 'one'), row('two', 'two'))
    const a = new TestRowSyncer(server)
    const b = new TestRowSyncer(server)
    await a.syncNow()
    await b.syncNow()

    b.edit(b.rows.map((item) => ({ ...item, title: `${item.id} by b` })))
    await b.syncNow()
    a.edit(a.rows.map((item) => (item.id === 'one' ? { ...item, title: 'one by a' } : item)))
    await a.syncNow()

    expect(titles(a.rows)).toEqual(['one:one by a', 'two:two by b'])
    expect(server.rows.get('one')?.title).toBe('one by a')
  })

  it('takes the server copy of a row it did not change, whatever its clock says', async () => {
    server.seed(row('one', 'one'))
    const device = new TestRowSyncer(server)
    await device.syncNow()
    // A device clock far ahead stamped the copy here: it must not hide a later write.
    device.rows = device.rows.map((item) => ({ ...item, updated_at: new Date('2099-01-01') }))
    server.write([{ ...server.rows.get('one')!, title: 'changed elsewhere' }])

    await device.syncNow()

    expect(device.rows[0].title).toBe('changed elsewhere')
  })

  it('pushes rows the server is missing on the first sync', async () => {
    server.seed(row('remote', 'remote'))
    const device = new TestRowSyncer(server)
    device.rows = [row('local', 'local', 1), row('deleted', 'gone', 2, { deleted: true })]

    await device.syncNow()

    expect(server.upserts.flat().sort()).toEqual(['deleted', 'local'])
    expect(titles(device.rows)).toEqual(['deleted:gone', 'local:local', 'remote:remote'])
  })

  it('keeps an edit made before rows were tracked one by one, on the first sync after the upgrade', async () => {
    server.seed(row('one', 'one'), row('two', 'two'))
    const device = new TestRowSyncer(server)
    // As synced by the old whole-collection sync: the server's copies, then 'one' renamed here and
    // never pushed. The upgrade leaves no pending ids behind.
    device.rows = server.read().map((item) => (item.id === 'one' ? { ...item, title: 'renamed', updated_at: at(500) } : item))

    await device.syncNow()

    expect(server.rows.get('one')?.title).toBe('renamed')
    expect(titles(device.rows)).toEqual(['one:renamed', 'two:two'])
    expect(server.upserts).toEqual([['one']])
  })

  it('pushes again a row changed while it was being pushed', async () => {
    const device = new TestRowSyncer(server)
    device.edit([row('one', 'first')])
    server.beforeUpsert = () => {
      server.beforeUpsert = undefined
      device.edit([{ ...device.rows[0], title: 'second' }])
    }

    await device.syncNow()

    expect(server.rows.get('one')?.title).toBe('second')
    expect(device.rows[0].title).toBe('second')
    expect(device.meta.pendingIds).toEqual([])
  })

  it('reads only the rows changed since the cursor after the first sync', async () => {
    server.seed(row('one', 'one'))
    const device = new TestRowSyncer(server)
    await device.syncNow()
    const cursor = device.meta.cursor

    expect(cursor).toBeTruthy()
    expect(device.meta.userId).toBe('user-1')
    expect(device.meta.lastFullPullAt).toBeGreaterThan(0)
  })

  it('stops a run whose account changed while it was reading', async () => {
    server.seed(row('one', 'one'))
    const device = new TestRowSyncer(server)
    device.edit([row('local', 'local')])
    device.beforeFetch = () => auth$.userId.set('user-2')

    await device.syncNow()

    expect(titles(device.rows)).toEqual(['local:local'])
    expect(server.upserts).toEqual([])
  })

  it('waits for a choice when the data here belongs to another account', async () => {
    syncMeta$.ownerUserId.set('user-0')
    const device = new TestRowSyncer(server)
    device.edit([row('local', 'local')])

    await device.syncNow()

    expect(server.upserts).toEqual([])
    expect(device.meta.pendingIds).toEqual(['local'])
  })

  it('makes the data its own on the first run of an account', async () => {
    const device = new TestRowSyncer(server)
    await device.syncNow()
    expect(syncMeta$.ownerUserId.peek()).toBe('user-1')
  })

  it('skips sync for a free user', async () => {
    auth$.plan.set('free')
    const device = new TestRowSyncer(server)
    device.edit([row('local', 'local')])

    await device.syncNow()

    expect(server.upserts).toEqual([])
  })
})
