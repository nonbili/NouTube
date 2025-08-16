import { observablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'

export function getIndexedDBPlugin() {
  // https://legendapp.com/open-source/state/v3/sync/persist-sync/#indexeddb-react
  return observablePersistIndexedDB({
    databaseName: 'noutube',
    version: 1,
    tableNames: ['store'],
  })
}
