import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import {
  addBlocklistEntry,
  createDefaultBlocklistSnapshot,
  normalizeBlocklist,
  type BlocklistEntry,
  type BlocklistSnapshot,
} from '@/lib/blocklist'

interface Store extends BlocklistSnapshot {
  addChannel: (value: string) => string
  addKeyword: (value: string) => string
  toggleChannel: (id: string) => void
  toggleKeyword: (id: string) => void
  deleteChannel: (id: string) => void
  deleteKeyword: (id: string) => void
}

const toggleEntry = (entries: BlocklistEntry[], id: string) => {
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    return entries
  }

  const next = entries.slice()
  next[index] = { ...next[index], enabled: !next[index].enabled }
  return next
}

export const blocklist$ = observable<Store>({
  ...createDefaultBlocklistSnapshot(),

  addChannel: (value) => {
    const result = addBlocklistEntry(blocklist$.channels.get(), value)
    blocklist$.channels.set(result.entries)
    return result.id
  },

  addKeyword: (value) => {
    const result = addBlocklistEntry(blocklist$.keywords.get(), value)
    blocklist$.keywords.set(result.entries)
    return result.id
  },

  toggleChannel: (id) => {
    blocklist$.channels.set(toggleEntry(blocklist$.channels.get(), id))
  },

  toggleKeyword: (id) => {
    blocklist$.keywords.set(toggleEntry(blocklist$.keywords.get(), id))
  },

  deleteChannel: (id) => {
    blocklist$.channels.set(blocklist$.channels.get().filter((entry) => entry.id !== id))
  },

  deleteKeyword: (id) => {
    blocklist$.keywords.set(blocklist$.keywords.get().filter((entry) => entry.id !== id))
  },
})

export const getBlocklistSnapshot = (value: Partial<Store> | undefined = blocklist$.get()): BlocklistSnapshot =>
  normalizeBlocklist(value)

syncObservable(blocklist$, {
  persist: {
    name: 'blocklist',
    plugin: ObservablePersistMMKV,
    transform: {
      load: (data: Store) => normalizeBlocklist(data),
    },
  },
})
