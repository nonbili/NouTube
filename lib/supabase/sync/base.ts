import { PostgrestError } from '@supabase/supabase-js'
import { partition } from 'es-toolkit'
import { auth$ } from '@/states/auth'
import { createLogger } from '@/lib/log'
import type { ResourceSyncMeta } from '@/states/sync-meta'
import { supabase } from '../client'
import { decideCollectionSync } from './decision'

const PAGE_SIZE = 1000
const syncDelayMs = 5 * 1000
const traceLogger = createLogger('sync', { devOnly: true })
const errorLogger = createLogger('sync')

interface Item {
  id: string
  json: { deleted?: boolean }
  created_at: Date | string
  updated_at: Date | string | null | undefined
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const toDate = (value: Date | string | null | undefined, fallback = new Date(0)) => {
  if (value instanceof Date) {
    return new Date(value)
  }

  if (!value) {
    return new Date(fallback)
  }

  return new Date(value)
}

const toRemoteTimestamp = (value: Date | undefined) => {
  if (!value || Number.isNaN(value.getTime()) || value.getTime() <= 0) {
    return undefined
  }

  return value.toISOString()
}

const getItemUpdatedAt = <T extends Item>(item: T) => toDate(item.updated_at, toDate(item.created_at))

const getChangedItems = <T extends Item>(items: T[], lastSyncedRemoteUpdatedAt?: string) => {
  if (!lastSyncedRemoteUpdatedAt) {
    return items
  }

  const baseline = toDate(lastSyncedRemoteUpdatedAt)
  return items.filter((item) => getItemUpdatedAt(item) > baseline)
}

const getCollectionUpdatedAt = <T extends Item>(items: T[]) =>
  toRemoteTimestamp(
    items.reduce<Date | undefined>((latest, item) => {
      const updatedAt = getItemUpdatedAt(item)
      if (!latest || updatedAt > latest) {
        return updatedAt
      }

      return latest
    }, undefined),
  )

const hasSameCollectionState = <T extends Item>(left: T[], right: T[]) => {
  if (left.length !== right.length) {
    return false
  }

  const leftMap = new Map(left.map((item) => [item.id, getItemUpdatedAt(item).toISOString()]))
  for (const item of right) {
    if (leftMap.get(item.id) !== getItemUpdatedAt(item).toISOString()) {
      return false
    }
  }

  return true
}

export abstract class BaseSyncer<T extends Item> {
  abstract NAME: string
  abstract TABLE_NAME: string
  abstract COLUMNS: string
  abstract pushWhenRemoteMissing: boolean

  abstract isPersistLoaded(): Promise<boolean>
  abstract getStore(): { items: T[]; updatedAt: Date }
  abstract setStore(data: { items: T[]; updatedAt: Date }): void
  abstract getMeta(): ResourceSyncMeta<T[]>
  abstract setMeta(meta: Partial<ResourceSyncMeta<T[]>>): void
  abstract hasMeaningfulLocalValue(items: T[]): boolean

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

  private cloneItems(items: T[]): T[] {
    return items.map((item) => ({
      ...item,
      json: JSON.parse(JSON.stringify(item.json)),
      created_at: toDate(item.created_at),
      updated_at: toDate(item.updated_at, toDate(item.created_at)),
    }))
  }

  private getRemoteUpdatedAt(items: T[]) {
    return getCollectionUpdatedAt(items)
  }

  private replaceLocal(items: T[], remoteUpdatedAt?: string) {
    this.applyingRemote = true
    try {
      this.setStore({
        items,
        updatedAt: remoteUpdatedAt ? new Date(remoteUpdatedAt) : new Date(0),
      })
    } finally {
      this.applyingRemote = false
    }
  }

  private async performSync() {
    try {
      await this.isPersistLoaded()

      const { items } = this.getStore()
      const localItems = this.cloneItems(items)
      const meta = this.getMeta()
      const remoteItems = await this.fetchItems()
      const remoteUpdatedAt = this.getRemoteUpdatedAt(remoteItems)
      const matchesRemote = hasSameCollectionState(localItems, remoteItems)
      const decision = decideCollectionSync({
        dirty: meta.dirty,
        hasRemoteItems: remoteItems.length > 0,
        remoteUpdatedAt,
        lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
        pushWhenRemoteMissing: this.pushWhenRemoteMissing,
        hasMeaningfulLocalValue: this.hasMeaningfulLocalValue(localItems),
      })

      this.log('decision', {
        action: decision.action,
        backupLocal: decision.backupLocal,
        dirty: meta.dirty,
        remoteUpdatedAt,
        lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
        remoteItems: remoteItems.length,
        localItems: localItems.length,
      })

      if (decision.action === 'pull') {
        if (decision.backupLocal) {
          this.log('backing up local state before pull', { remoteUpdatedAt })
          this.setMeta({
            backup: {
              value: localItems,
              savedAt: Date.now(),
              remoteUpdatedAt,
            },
          })
        }

        this.replaceLocal(remoteItems, remoteUpdatedAt)
        this.setMeta({
          dirty: false,
          lastError: undefined,
          lastSuccessfulSyncAt: Date.now(),
          lastSyncedRemoteUpdatedAt: remoteUpdatedAt,
        })
        this.log('pulled remote state', { remoteUpdatedAt, itemCount: remoteItems.length })
        return
      }

      if (decision.action === 'push') {
        let changedItems = getChangedItems(localItems, meta.lastSyncedRemoteUpdatedAt)
        if (meta.lastSyncedRemoteUpdatedAt && !changedItems.length && localItems.length) {
          changedItems = localItems
          this.log('dirty state had no delta rows; falling back to full push', {
            lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
            itemCount: localItems.length,
          })
        }

        const [deleted, active] = partition(changedItems, (item) => Boolean(item.json.deleted))
        await this.deleteItems(deleted)
        await this.saveItems(active)

        const nextRemoteUpdatedAt = this.getRemoteUpdatedAt(localItems)
        this.setMeta({
          dirty: false,
          lastError: undefined,
          lastSuccessfulSyncAt: Date.now(),
          lastSyncedRemoteUpdatedAt: nextRemoteUpdatedAt,
        })
        this.log('pushed local state', {
          remoteUpdatedAt: nextRemoteUpdatedAt,
          saved: active.length,
          deleted: deleted.length,
          changed: changedItems.length,
        })
        return
      }

      if (!matchesRemote) {
        this.log('pulling remote state because collection differs despite unchanged timestamp', {
          remoteUpdatedAt,
          lastSyncedRemoteUpdatedAt: meta.lastSyncedRemoteUpdatedAt,
          remoteItems: remoteItems.length,
          localItems: localItems.length,
        })
        this.replaceLocal(remoteItems, remoteUpdatedAt)
        this.setMeta({
          dirty: false,
          lastError: undefined,
          lastSuccessfulSyncAt: Date.now(),
          lastSyncedRemoteUpdatedAt: remoteUpdatedAt,
        })
        return
      }

      this.setMeta({
        lastError: undefined,
        lastSuccessfulSyncAt: Date.now(),
        lastSyncedRemoteUpdatedAt: remoteUpdatedAt ?? meta.lastSyncedRemoteUpdatedAt,
      })
      this.log('no changes to apply', {
        remoteUpdatedAt,
        lastSyncedRemoteUpdatedAt: remoteUpdatedAt ?? meta.lastSyncedRemoteUpdatedAt,
      })
    } catch (error) {
      this.setMeta({ lastError: getErrorMessage(error) })
      this.log('sync failed', { error: getErrorMessage(error) })
      throw error
    }
  }

  async fetchItems(start = 0, end = PAGE_SIZE - 1): Promise<T[]> {
    const { data, error } = (await supabase
      .from(this.TABLE_NAME)
      .select(this.COLUMNS)
      .order('created_at', { ascending: false })
      .range(start, end)) as unknown as { data: T[]; error: PostgrestError | null }

    if (error) {
      throw error
    }

    const items: T[] = data.map((item) => ({
      ...item,
      created_at: toDate(item.created_at),
      updated_at: toDate(item.updated_at, toDate(item.created_at)),
    })) as T[]

    if (data.length === PAGE_SIZE) {
      return items.concat(await this.fetchItems(start + PAGE_SIZE, end + PAGE_SIZE))
    }

    this.log('fetched remote rows', { count: items.length, start, end })
    return items
  }

  async saveItems(items: T[]) {
    if (!items.length) {
      return
    }

    await this.upsertItems(items)
    this.log('saved remote rows', { count: items.length })
  }

  private async upsertItems(items: T[]) {
    const userId = auth$.userId.get()
    if (!userId) {
      throw new Error(`sync ${this.NAME} skipped without authenticated user`)
    }

    const { error } = await supabase.from(this.TABLE_NAME).upsert(
      items.map((item) => ({
        ...item,
        user_id: userId,
        created_at: toDate(item.created_at).toISOString(),
        updated_at: toDate(item.updated_at, toDate(item.created_at)).toISOString(),
      })),
    )

    if (error) {
      throw error
    }
  }

  async deleteItems(items: T[]) {
    if (!items.length) {
      return
    }

    await this.upsertItems(items)
    this.log('saved remote tombstones', { count: items.length })
  }
}
