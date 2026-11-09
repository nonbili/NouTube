import type { PostgrestError } from '@supabase/supabase-js'
import { createLogger } from '@/lib/log'
import type { RowSyncMeta } from '@/states/sync-meta'
import { supabase } from '../client'
import { beginSync, canSync, isCurrentSession, type SyncSession } from './session'
import {
  collectChangedRowIds,
  collectUnsyncedRowIds,
  mergeRemoteRows,
  nextSyncCursor,
  sortRows,
  type SyncRow,
} from './rows'

// PostgREST answers with at most 1000 rows, so reads and writes go a page at a time.
export const SYNC_PAGE_SIZE = 500
const syncDelayMs = 5 * 1000
// Incremental pulls run this long before one full reconciliation, which picks up a row the cursor
// stepped over, and repairs a row whose push was lost.
const FULL_PULL_INTERVAL_MS = 24 * 60 * 60 * 1000
// Rounds a run may take when something changes here or on the server meanwhile.
const maxRounds = 5

const traceLogger = createLogger('sync', { devOnly: true })
const errorLogger = createLogger('sync')

class SyncInterrupted extends Error {}

// Supabase returns query failures as plain `{ message, code }` objects, not Errors.
export const describeSyncError = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const { message, code } = error as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message) {
      return typeof code === 'string' && code ? `${message} (${code})` : message
    }
    return JSON.stringify(error)
  }
  return String(error)
}

const quote = (value: string) => `"${value.replace(/"/g, '')}"`

const toDate = (value: unknown, fallback?: Date) => {
  const date = value instanceof Date ? new Date(value) : value ? new Date(value as string) : undefined
  return date && !Number.isNaN(date.getTime()) ? date : (fallback ?? new Date(0))
}

/** The rows of a table, and whether to fold several of them into one before they are pushed. */
export abstract class RowSyncer<T extends SyncRow> {
  abstract NAME: string
  abstract TABLE_NAME: string
  abstract COLUMNS: string

  abstract isPersistLoaded(): Promise<boolean>
  abstract getRows(): T[]
  abstract setRows(rows: T[]): void
  abstract getMeta(): RowSyncMeta
  abstract setMeta(meta: Partial<RowSyncMeta>): void

  /**
   * Rows the server would refuse side by side (one per url for bookmarks) put together. `synced`
   * tells a row the server has. Returns the rows, and the ids whose row changed or went.
   */
  fold(rows: T[], _synced: (id: string) => boolean): { rows: T[]; changed: string[]; dropped: string[] } {
    return { rows, changed: [], dropped: [] }
  }

  private applyingRemote = false
  private inFlight: Promise<void> | null = null
  private rerunRequested = false
  private timer: ReturnType<typeof setTimeout> | undefined

  private log(event: string, payload?: Record<string, unknown>) {
    traceLogger.child(this.NAME).log(event, payload)
  }

  isApplyingRemote() {
    return this.applyingRemote
  }

  /** Queues the rows changed here to be pushed; true when there was any. */
  trackLocalChange(rows: T[] | undefined, previous: T[] | undefined) {
    const ids = collectChangedRowIds(rows, previous)
    this.addPending(ids)
    return ids.length > 0
  }

  /** Puts rows in place without taking them for a change made here. */
  applyRemote(rows: T[]) {
    this.applyingRemote = true
    try {
      this.setRows(sortRows(rows))
    } finally {
      this.applyingRemote = false
    }
  }

  scheduleSync() {
    if (!canSync()) {
      return
    }

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.syncNow().catch((error) => {
        errorLogger.child(this.NAME).error('sync failed', error)
      })
    }, syncDelayMs)

    this.log('scheduled', { delayMs: syncDelayMs })
  }

  async syncNow() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }

    if (!canSync()) {
      this.log('skipped syncNow because sync is disabled')
      return
    }

    if (this.inFlight) {
      this.rerunRequested = true
      return this.inFlight
    }

    const run = this.runLoop().finally(() => {
      if (this.inFlight === run) {
        this.inFlight = null
      }
    })

    this.inFlight = run
    return run
  }

  private addPending(ids: string[]) {
    if (!ids.length) return
    const pending = this.getMeta().pendingIds
    this.setMeta({ pendingIds: Array.from(new Set([...pending, ...ids])) })
  }

  private async runLoop() {
    let rounds = 0
    do {
      this.rerunRequested = false
      let session: SyncSession | null = null
      try {
        await this.isPersistLoaded()
        session = await beginSync()
        if (!session) {
          this.log('skipped performSync because sync is disabled')
          return
        }
        await this.performSync(session)
      } catch (error) {
        if (error instanceof SyncInterrupted) return
        if (!session || isCurrentSession(session)) this.setMeta({ lastError: describeSyncError(error) })
        this.log('sync failed', { error: describeSyncError(error) })
        throw error
      }
      rounds += 1
    } while (this.rerunRequested && rounds < maxRounds)

    // Written over again and again: left for a later run rather than kept going.
    if (this.rerunRequested) {
      this.rerunRequested = false
      this.scheduleSync()
    }
  }

  private async performSync(session: SyncSession) {
    const { userId } = session
    const assertCurrent = () => {
      if (!isCurrentSession(session)) throw new SyncInterrupted()
    }

    const meta = this.getMeta()
    const sameAccount = meta.userId === userId
    const cursor = sameAccount ? meta.cursor : undefined
    const firstPull = !cursor
    const isFullPull = firstPull || Date.now() - (meta.lastFullPullAt || 0) >= FULL_PULL_INTERVAL_MS
    const remote = await this.fetchRows(isFullPull ? undefined : cursor, assertCurrent)

    // Read now, not before the pull: what was changed here meanwhile is kept over what was pulled.
    const pending = new Set(this.getMeta().pendingIds)
    if (isFullPull) {
      // What the server does not have was never pushed: on the first sync of this device or
      // account, or when a push was lost. The first time, a row changed here before rows were
      // tracked one by one is newer here than there, and is pushed too. Told from the rows here
      // before the pull is put in place, or the server's copy would already have replaced them.
      const unsynced = collectUnsyncedRowIds(this.getRows(), remote, firstPull)
      unsynced.forEach((id) => pending.add(id))
    }
    let rows = mergeRemoteRows(this.getRows(), remote, pending)
    const remoteIds = new Set(remote.map((row) => row.id))
    const folded = this.fold(rows, (id) => remoteIds.has(id) || !pending.has(id))
    rows = folded.rows
    folded.changed.forEach((id) => pending.add(id))
    folded.dropped.forEach((id) => pending.delete(id))
    this.applyRemote(rows)
    this.setMeta({ pendingIds: [...pending] })

    try {
      await this.push(userId, assertCurrent)
    } catch (error) {
      // Another device saved the same page under another id since the pull: read it whole, fold the two.
      if ((error as PostgrestError | undefined)?.code === '23505') {
        this.log('push hit a row the pull has not seen; full pull next', { error: describeSyncError(error) })
        this.setMeta({ lastFullPullAt: 0 })
        this.rerunRequested = true
        return
      }
      throw error
    }

    // Only pulled rows move the cursor: a pushed row's time could step past another device's write.
    this.setMeta({
      userId,
      cursor: nextSyncCursor(remote, cursor),
      ...(isFullPull ? { lastFullPullAt: Date.now() } : {}),
      lastSuccessfulSyncAt: Date.now(),
      lastError: undefined,
    })
    this.log('synced', { full: isFullPull, pulled: remote.length })
  }

  /** Every row changed after the cursor (every row without one), ordered so one written meanwhile is not skipped. */
  async fetchRows(cursor?: string, assertCurrent: () => void = () => {}): Promise<T[]> {
    const rows: T[] = []
    // The server's own text of the last row's time: a Date keeps milliseconds, Postgres keeps
    // microseconds, and a keyset a little before the last row reads the same page again.
    let last: { updated_at: string; id: string } | undefined
    for (;;) {
      assertCurrent()
      let query = supabase
        .from(this.TABLE_NAME)
        .select(this.COLUMNS)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(SYNC_PAGE_SIZE)
      if (last) {
        const at = quote(last.updated_at)
        query = query.or(`updated_at.gt.${at},and(updated_at.eq.${at},id.gt.${quote(last.id)})`)
      } else if (cursor) {
        query = query.gt('updated_at', cursor)
      }
      const { data, error } = await query
      assertCurrent()
      if (error) throw error
      const raw = (data || []) as unknown as (T & { updated_at: string })[]
      last = raw.at(-1)
      const page = raw.map((row) => this.toLocal(row))
      rows.push(...page)
      if (page.length < SYNC_PAGE_SIZE) {
        this.log('fetched remote rows', { count: rows.length, incremental: Boolean(cursor) })
        return rows
      }
    }
  }

  toLocal(row: T): T {
    const created_at = toDate(row.created_at)
    return { ...row, json: row.json || {}, created_at, updated_at: toDate(row.updated_at, created_at) }
  }

  toRemote(userId: string, row: T) {
    // Only the table's columns: a field kept on the device alone would fail the whole batch.
    const columns = this.COLUMNS.split(',')
    return {
      ...Object.fromEntries(columns.map((column) => [column, row[column as keyof T]])),
      user_id: userId,
      created_at: toDate(row.created_at).toISOString(),
      updated_at: toDate(row.updated_at, toDate(row.created_at)).toISOString(),
    }
  }

  /** Writes rows, and returns them as the server keeps them. */
  async upsertRows(userId: string, rows: T[]): Promise<T[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .upsert(rows.map((row) => this.toRemote(userId, row)))
      .select(this.COLUMNS)
    if (error) throw error
    return ((data || []) as unknown as T[]).map((row) => this.toLocal(row))
  }

  /** Pushes the rows changed here, and takes the server's copy of each one not changed again meanwhile. */
  private async push(userId: string, assertCurrent: () => void) {
    const ids = this.getMeta().pendingIds
    if (!ids.length) return

    const byId = new Map(this.getRows().map((row) => [row.id, row]))
    const rows = ids.map((id) => byId.get(id)).filter((row): row is T => Boolean(row))
    const sent = new Map(rows.map((row) => [row.id, JSON.stringify(row)]))
    const echoed: T[] = []
    for (let index = 0; index < rows.length; index += SYNC_PAGE_SIZE) {
      assertCurrent()
      const batch = await this.upsertRows(userId, rows.slice(index, index + SYNC_PAGE_SIZE))
      assertCurrent()
      echoed.push(...batch)
    }

    // A row changed again while it was pushed stays to be pushed again; the rest take the server's time.
    const now = new Map(this.getRows().map((row) => [row.id, row]))
    const settled = new Set<string>()
    for (const [id, json] of sent) {
      const row = now.get(id)
      if (!row || JSON.stringify(row) === json) settled.add(id)
    }
    const echoById = new Map(echoed.filter((row) => settled.has(row.id)).map((row) => [row.id, row]))
    if (echoById.size) {
      this.applyRemote(this.getRows().map((row) => echoById.get(row.id) ?? row))
    }
    this.setMeta({ pendingIds: this.getMeta().pendingIds.filter((id) => !settled.has(id)) })
    if (settled.size < sent.size) this.rerunRequested = true
    this.log('pushed', { count: rows.length, changedMeanwhile: sent.size - settled.size })
  }
}
