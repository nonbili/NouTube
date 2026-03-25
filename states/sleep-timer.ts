import { observable } from '@legendapp/state'

interface Store {
  expiresAtMs: number | null
  setRemainingMs: (remainingMs: number | null) => void
  clear: () => void
}

export const sleepTimer$ = observable<Store>({
  expiresAtMs: null,
  setRemainingMs: (remainingMs) => {
    if (remainingMs == null || remainingMs <= 0) {
      sleepTimer$.expiresAtMs.set(null)
      return
    }
    sleepTimer$.expiresAtMs.set(Date.now() + remainingMs)
  },
  clear: () => {
    sleepTimer$.expiresAtMs.set(null)
  },
})
