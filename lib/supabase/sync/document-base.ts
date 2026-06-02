import { PostgrestError } from '@supabase/supabase-js'
import { auth$ } from '@/states/auth'
import { createLogger } from '@/lib/log'
import type { ResourceSyncMeta } from '@/states/sync-meta'
import { supabase } from '../client'
import { decideDocumentSync } from './decision'

interface RemoteDocument<T> {
  value: T
  updatedAt: string
}

const syncDelayMs = 5 * 1000
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

  markDirty() {
    const meta = this.getMeta()
    if (!meta.dirty || meta.lastError) {
      this.log('marked dirty', {
        hadDirtyFlag: meta.dirty,
        previousError: meta.lastError,
      })
      this.setMeta({ dirty: true, lastError: undefined })
    }
  }

  scheduleSync() {
    if (!this.canSync()) {
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

    if (!this.canSync()) {
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

  private canSync() {
    const { userId, plan } = auth$.get()
    return Boolean(userId && plan && plan !== 'free')
  }

  private async runLoop() {
    do {
      this.rerunRequested = false
      await this.performSync()
    } while (this.rerunRequested)
  }

  private async performSync() {
    try {
      await this.isPersistLoaded()

      const localValue = cloneValue(this.getValue())
      const meta = this.getMeta()
      const remote = await this.fetchRemote()
      const decision = decideDocumentSync({
        dirty: meta.dirty,
        hasRemote: Boolean(remote),
        remoteUpdatedAt: remote?.updatedAt,
        lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
        pushWhenRemoteMissing: this.pushWhenRemoteMissing,
        hasMeaningfulLocalValue: this.hasMeaningfulLocalValue(localValue),
      })

      this.log('decision', {
        action: decision.action,
        backupLocal: decision.backupLocal,
        dirty: meta.dirty,
        hasRemote: Boolean(remote),
        remoteUpdatedAt: remote?.updatedAt,
        lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
      })

      if (decision.action === 'pull' && remote) {
        if (decision.backupLocal) {
          this.log('backing up local state before pull', { remoteUpdatedAt: remote.updatedAt })
          this.setMeta({
            backup: {
              value: localValue,
              savedAt: Date.now(),
              remoteUpdatedAt: remote.updatedAt,
            },
          })
        }

        this.applyingRemote = true
        try {
          this.setValue(cloneValue(remote.value))
        } finally {
          this.applyingRemote = false
        }

        this.setMeta({
          dirty: false,
          lastError: undefined,
          lastSuccessfulSyncAt: Date.now(),
          lastSyncedRemoteUpdatedAt: remote.updatedAt,
        })
        this.log('pulled remote state', { remoteUpdatedAt: remote.updatedAt })
        return
      }

      if (decision.action === 'push') {
        const saved = await this.saveRemote(localValue)
        this.setMeta({
          dirty: false,
          lastError: undefined,
          lastSuccessfulSyncAt: Date.now(),
          lastSyncedRemoteUpdatedAt: saved.updatedAt,
        })
        this.log('pushed local state', { remoteUpdatedAt: saved.updatedAt })
        return
      }

      this.setMeta({
        lastError: undefined,
        lastSuccessfulSyncAt: Date.now(),
        lastSyncedRemoteUpdatedAt: remote?.updatedAt ?? meta.lastSyncedRemoteUpdatedAt,
      })
      this.log('no changes to apply', {
        remoteUpdatedAt: remote?.updatedAt,
        lastSyncedRemoteUpdatedAt: remote?.updatedAt ?? meta.lastSyncedRemoteUpdatedAt,
      })
    } catch (error) {
      this.setMeta({ lastError: getErrorMessage(error) })
      this.log('sync failed', { error: getErrorMessage(error) })
      throw error
    }
  }

  async fetchRemote(): Promise<RemoteDocument<T> | null> {
    const { data, error } = (await supabase.from(this.TABLE_NAME).select('json,updated_at').single()) as unknown as {
      data: { json: T; updated_at: string } | null
      error: PostgrestError | null
    }

    if (error) {
      if (error.code === 'PGRST116') {
        this.log('remote row missing')
        return null
      }
      throw error
    }

    if (!data) {
      return null
    }

    this.log('fetched remote row', { remoteUpdatedAt: data.updated_at })
    return {
      value: data.json,
      updatedAt: data.updated_at,
    }
  }

  async saveRemote(value: T): Promise<RemoteDocument<T>> {
    const userId = auth$.userId.get()
    if (!userId) {
      throw new Error(`sync ${this.NAME} skipped without authenticated user`)
    }

    const { data, error } = (await supabase
      .from(this.TABLE_NAME)
      .upsert({
        user_id: userId,
        json: value,
      })
      .select('json,updated_at')
      .single()) as unknown as {
      data: { json: T; updated_at: string }
      error: PostgrestError | null
    }

    if (error) {
      throw error
    }

    this.log('saved remote row', { remoteUpdatedAt: data.updated_at })
    return {
      value: data.json,
      updatedAt: data.updated_at,
    }
  }
}
