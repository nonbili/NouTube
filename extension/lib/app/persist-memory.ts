import { ObservablePersistLocalStorageBase } from '@legendapp/state/persist-plugins/local-storage'

/*
 * Stands in for the app's MMKV and IndexedDB persist plugins, which the build
 * aliases away. MMKV's web backend is localStorage, which a service worker does
 * not have, and two contexts persisting the same observables would fight over
 * the same rows anyway. Here the background is the single owner: it hydrates the
 * observables from `browser.storage.local` and writes them back itself, so the
 * plugins only have to be inert and report themselves loaded.
 */
const memoryStorage = {
  length: 0,
  clear: () => undefined,
  key: () => null,
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage

export class ObservablePersistMMKV extends ObservablePersistLocalStorageBase {
  constructor() {
    super(memoryStorage)
  }
}

export const observablePersistMMKV = () => new ObservablePersistMMKV()

/* `@/states/indexeddb` resolves here too. */
export const getIndexedDBPlugin = () => new ObservablePersistMMKV()
