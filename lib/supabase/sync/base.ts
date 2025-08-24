import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../client'
import { auth$ } from '@/states/auth'
import { debounce, partition } from 'es-toolkit'

const PAGE_SIZE = 1000

interface Item {
  id: string
  json: { deleted?: boolean }
  created_at: Date
  updated_at: Date
}

export abstract class BaseSyncer<T extends Item> {
  abstract NAME: string
  abstract TABLE_NAME: string
  abstract COLUMNS: string
  abstract SYNC_STATE_FIELD: string

  abstract isPersistLoaded(): Promise<boolean>

  abstract getStore(): { items: T[]; updatedAt: Date; syncedAt: Date | undefined }

  abstract setStore(data: { items: T[]; updatedAt: Date }): void

  abstract importItems(items: T[]): void

  abstract setSyncedTime(): void

  async fetchItems(start = 0, end = PAGE_SIZE - 1): Promise<T[]> {
    const { data, error } = (await supabase
      .from(this.TABLE_NAME)
      .select(this.COLUMNS)
      .order('created_at', { ascending: false })
      .range(start, end)) as unknown as { data: T[]; error: PostgrestError | null }
    if (error) {
      console.error(error)
      return []
    }
    let next: T[] = []
    if (data.length == PAGE_SIZE) {
      next = await this.fetchItems(start + PAGE_SIZE, end + PAGE_SIZE)
    }
    return data
      .map((x) => ({
        ...x,
        created_at: new Date(x.created_at),
        updated_at: new Date(x.updated_at),
      }))
      .concat(next)
  }

  async saveItems(items: T[]) {
    const user_id = auth$.userId.get()
    if (!user_id) {
      return
    }

    const { count, error } = await supabase.from(this.TABLE_NAME).upsert(
      items.map((x) => ({
        ...x,
        user_id,
      })),
      { count: 'estimated' },
    )
    if (error) {
      throw error
    }
    console.log(`saved ${count} ${this.NAME}`)
  }

  async deleteItems(items: T[]) {
    const { count, error } = await supabase
      .from(this.TABLE_NAME)
      .delete({ count: 'estimated' })
      .in(
        'id',
        items.map((x) => x.id),
      )
    if (error) {
      throw error
    }
    console.log(`deleted ${count} ${this.NAME}`)
  }

  private _sync = async (fullSync?: boolean) => {
    await this.isPersistLoaded()

    const { userId: user_id } = auth$.get()
    if (!user_id) {
      return
    }

    const { data, error } = await supabase.from('nou_sync_states').select('json')
    if (error) {
      throw error
    }

    const remoteSyncState = data[0]?.json
    const remoteUpdatedAt = new Date(remoteSyncState?.[this.SYNC_STATE_FIELD] || 1970)
    const { items, updatedAt, syncedAt } = this.getStore()
    console.log(`sync ${this.NAME}`, remoteSyncState, updatedAt, syncedAt)

    const updateRemoteSyncState = async (value: Date) => {
      await supabase
        .from('nou_sync_states')
        .upsert({ json: { ...remoteSyncState, [this.SYNC_STATE_FIELD]: value }, user_id })
    }

    if (!remoteSyncState?.[this.SYNC_STATE_FIELD]) {
      if (items.length) {
        // full sync: local -> remote
        console.log('full sync: local -> remote')
        await this.saveItems(items)
        await updateRemoteSyncState(updatedAt)
      }
      this.setSyncedTime()
      return
    }

    if (!syncedAt && items.length) {
      const remoteItems = await this.fetchItems()
      // 1. sync local -> remote
      await this.saveItems(items)
      // 2. sync remote -> local
      this.importItems(remoteItems)
      if (updatedAt > remoteUpdatedAt) {
        await updateRemoteSyncState(updatedAt)
      }
    }

    if (fullSync || remoteUpdatedAt > updatedAt) {
      // full sync: remote -> local
      console.log('full sync: remote -> local')
      const remoteItems = await this.fetchItems()
      this.setStore({
        items: remoteItems,
        updatedAt: remoteUpdatedAt,
      })
    } else if (remoteUpdatedAt < updatedAt) {
      // partial sync: local -> remote
      console.log('partial sync: local -> remote')
      const [deleted, updates] = partition(
        items.filter((x) => x.updated_at > remoteUpdatedAt),
        (x) => !!x.json.deleted,
      )
      await this.deleteItems(deleted)
      await this.saveItems(updates)
      await updateRemoteSyncState(updatedAt)
    }

    this.setSyncedTime()
  }

  private debouncedSync = debounce(
    this._sync,
    60 * 1000, // 1 minute
    { edges: ['leading', 'trailing'] },
  )

  async sync(fullSync?: boolean) {
    const { userId, plan } = auth$.get()
    if (userId && plan && plan != 'free') {
      this.debouncedSync(fullSync)
    }
  }
}
