import { PostgrestError } from '@supabase/supabase-js'
import { createLogger } from '@/lib/log'
import type { ResourceSyncMeta } from '@/states/sync-meta'
import { supabase } from '../client'
import { decideDocumentSync } from './decision'
import { same, type MergeResult } from './merge'
import { beginSync, canSync, isCurrentSession, type SyncSession } from './session'

export interface RemoteDocument<T> {
  value: T
  updatedAt: string
}

const syncDelayMs = 5 * 1000
// Rounds a run may take when a write is refused or something changes here meanwhile.
const maxRounds = 5
const traceLogger = createLogger('sync', { devOnly: true })
const errorLogger = createLogger('sync')

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export abstract class DocumentSyncer<T> {
  abstract NAME: string
  abstract TABLE_NAME: string
  abstract pushWhenRemoteMissing: boolean

  abstract isPersistLoaded(): Promise<boolean>
  abstract getValue(): T
  abstract setValue(value: T): void
  abstract hasMeaningfulLocalValue(value: T): boolean
  abstract getMeta(): ResourceSyncMeta<T>
  abstract setMeta(meta: Partial<ResourceSyncMeta<T>>): void
  /** Puts together what changed here and on another device since `base`. */
  abstract merge(base: T | undefined, local: T, remote: T): MergeResult<T>

  private applyingRemote = false
  private inFlight: Promise<void> | null = null
  private rerunRequested = false
  private timer: ReturnType<typeof setTimeout> | undefined
  // Counts the changes made here, to tell one made while a request was out.
  private revision = 0

  private log(event: string, payload?: Record<string, unknown>) {
    traceLogger.child(this.NAME).log(event, payload)
  }

  isApplyingRemote() {
    return this.applyingRemote
  }

  markDirty() {
    this.revision += 1
    const meta = this.getMeta()
    if (!meta.dirty || meta.lastError) {
      this.log('marked dirty', {
        hadDirtyFlag: meta.dirty,
        previousError: meta.lastError,
      })
      this.setMeta({ dirty: true, lastError: undefined })
    }
  }

  /** Puts back what was here before a merge took the other device's side; it is written as a change made here. */
  restoreBackup() {
    const backup = this.getMeta().backup
    if (!backup) return
    this.setValue(cloneValue(backup.value))
    this.setMeta({ backup: undefined })
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
      this.log('cleared scheduled run before immediate sync')
    }

    if (!canSync()) {
      this.log('skipped syncNow because sync is disabled')
      return
    }

    if (this.inFlight) {
      this.rerunRequested = true
      this.log('sync already in flight; queued rerun')
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

  /** Puts a value pulled from the server in place, without taking it for a change made here. */
  applyRemote(value: T) {
    this.applyingRemote = true
    try {
      this.setValue(cloneValue(value))
    } finally {
      this.applyingRemote = false
    }
  }

  private async runLoop() {
    let rounds = 0
    do {
      this.rerunRequested = false
      await this.performSync()
      rounds += 1
    } while (this.rerunRequested && rounds < maxRounds)

    // Two devices writing over and over: left for a later run rather than kept going.
    if (this.rerunRequested) {
      this.rerunRequested = false
      this.scheduleSync()
    }
  }

  private async performSync() {
    let session: SyncSession | null = null
    try {
      await this.isPersistLoaded()
      session = await beginSync()
      if (!session) {
        this.log('skipped performSync because sync is disabled')
        return
      }

      const revision = this.revision
      const localValue = cloneValue(this.getValue())
      const meta = this.getMeta()
      const remote = await this.fetchRemote()
      // What was read belongs to the account the run started for.
      if (!isCurrentSession(session)) {
        this.log('account changed during fetch; stopped')
        return
      }
      const action = decideDocumentSync({
        dirty: meta.dirty,
        hasRemote: Boolean(remote),
        remoteUpdatedAt: remote?.updatedAt,
        lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
        pushWhenRemoteMissing: this.pushWhenRemoteMissing,
        hasMeaningfulLocalValue: this.hasMeaningfulLocalValue(localValue),
      })

      this.log('decision', {
        action,
        dirty: meta.dirty,
        hasRemote: Boolean(remote),
        remoteUpdatedAt: remote?.updatedAt,
        lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
      })

      if (action === 'noop') {
        // Synced before the base was kept: nothing changed on either side, so the row read is
        // what both agree on, and the next merge can tell whose change is whose.
        const base = !meta.base && remote && remote.updatedAt === meta.lastSyncedRemoteUpdatedAt ? { base: cloneValue(remote.value) } : {}
        this.setMeta({ ...base, lastError: undefined, lastSuccessfulSyncAt: Date.now() })
        return
      }

      // Changed here while the row was read: read it again, with that change.
      if (this.revision !== revision) {
        this.log('local change during fetch; rerun')
        this.rerunRequested = true
        return
      }

      if (action === 'pull' && remote) {
        this.applyRemote(remote.value)
        this.setAgreed(remote.updatedAt, remote.value, false)
        this.log('pulled remote state', { remoteUpdatedAt: remote.updatedAt })
        return
      }

      let value = localValue
      let lost = false
      if (action === 'merge' && remote) {
        const merged = this.merge(meta.base, localValue, remote.value)
        value = merged.value
        lost = merged.lost
        if (same(value, remote.value)) {
          this.keepMerge(localValue, remote.updatedAt, lost)
          this.applyRemote(value)
          this.setAgreed(remote.updatedAt, remote.value, false)
          this.log('merged into remote state', { remoteUpdatedAt: remote.updatedAt })
          return
        }
      }

      // The merge is put in place here only once written: were the write refused, what is here has
      // to be what this device changed, to merge again against what the other device wrote.
      const saved = await this.saveRemote(session.userId, value, remote?.updatedAt)
      if (!isCurrentSession(session)) {
        this.log('account changed during push; stopped')
        return
      }
      if (!saved.ok) {
        // Another device wrote first: read what it wrote and merge again.
        this.log('write refused, remote changed', { remoteUpdatedAt: saved.updatedAt })
        this.rerunRequested = true
        return
      }

      // A change made here while writing stays to be written.
      const changed = this.revision !== revision
      if (action === 'merge' && remote) {
        this.keepMerge(localValue, remote.updatedAt, lost)
        // Changed here meanwhile: those changes go on top of the merge, over what it took.
        this.applyRemote(changed ? this.merge(localValue, value, cloneValue(this.getValue())).value : value)
      }
      this.setAgreed(saved.updatedAt!, value, changed)
      if (changed) this.rerunRequested = true
      this.log('pushed local state', { remoteUpdatedAt: saved.updatedAt, changedMeanwhile: changed })
    } catch (error) {
      if (session && !isCurrentSession(session)) {
        return
      }
      this.setMeta({ lastError: getErrorMessage(error) })
      this.log('sync failed', { error: getErrorMessage(error) })
      throw error
    }
  }

  /** Keeps what was here as the backup, when the merge took the other device's side of something. */
  private keepMerge(localValue: T, remoteUpdatedAt: string, lost: boolean) {
    if (!lost) return
    this.log('backing up local state lost in merge', { remoteUpdatedAt })
    this.setMeta({ backup: { value: localValue, savedAt: Date.now(), remoteUpdatedAt } })
  }

  /** This device and the server agree on `value`, as the row of `updatedAt`. */
  private setAgreed(updatedAt: string, value: T, dirty: boolean) {
    this.setMeta({
      dirty,
      lastError: undefined,
      lastSuccessfulSyncAt: Date.now(),
      lastSyncedRemoteUpdatedAt: updatedAt,
      base: cloneValue(value),
    })
  }

  async fetchRemote(): Promise<RemoteDocument<T> | null> {
    const { data, error } = (await supabase.from(this.TABLE_NAME).select('json,updated_at').single()) as unknown as {
      data: { json: T; updated_at: string }
      error: PostgrestError | null
    }

    if (error) {
      if (error.code === 'PGRST116') {
        this.log('remote row missing')
        return null
      }
      throw error
    }

    this.log('fetched remote row', { remoteUpdatedAt: data.updated_at })
    return {
      value: data.json,
      updatedAt: data.updated_at,
    }
  }

  /** Writes `value` if the row is still the one of `base` (no row, when absent). */
  protected async saveRemote(userId: string, value: T, base: string | undefined): Promise<{ ok: boolean; updatedAt?: string }> {
    // The server refuses it when the token the request carries is of another account.
    const { data, error } = await supabase.rpc('nou_put_doc', {
      p_user: userId,
      p_table: this.TABLE_NAME,
      p_json: value,
      p_base: base ?? null,
    })
    if (error) {
      throw error
    }

    const result = data as { ok: boolean; updated_at: string | null }
    return { ok: result.ok, updatedAt: result.updated_at ?? undefined }
  }
}
