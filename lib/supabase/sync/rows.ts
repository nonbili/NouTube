/** Rows synced one by one: bookmarks and folders. */
export interface SyncRow {
  id: string
  json: { deleted?: boolean }
  created_at: Date
  updated_at: Date
}

// `updated_at` is the server's `now()`, the start of the writing transaction, so a slow one can
// commit after a pull has read past it and land below that pull's newest row. Going back this far
// picks it up on the next pull; the daily full pull makes sure of what this misses.
export const SYNC_CURSOR_OVERLAP_MS = 30_000

const time = (value: Date | string | undefined) => {
  const parsed = value instanceof Date ? value.getTime() : value ? Date.parse(value) : Number.NaN
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Which rows changed, so a push carries only those. */
export function collectChangedRowIds<T extends { id: string }>(rows: T[] | undefined, previous: T[] | undefined) {
  const previousById = new Map((previous || []).map((row) => [row.id, JSON.stringify(row)]))
  const changed: string[] = []
  for (const row of rows || []) {
    if (previousById.get(row.id) !== JSON.stringify(row)) {
      changed.push(row.id)
    }
  }
  return changed
}

/**
 * Pulled rows put in place of this device's. A row changed here and not pushed yet keeps this
 * device's copy, which goes to the server next; any other takes the server's, whatever the clocks say.
 */
export function mergeRemoteRows<T extends { id: string }>(local: T[], remote: T[], pending: ReadonlySet<string>) {
  const byId = new Map(local.map((row) => [row.id, row]))
  for (const row of remote) {
    if (pending.has(row.id) && byId.has(row.id)) continue
    byId.set(row.id, row)
  }
  return [...byId.values()]
}

/**
 * Rows the server does not have, from a full read of its rows: never pushed, or a push was lost.
 * With `newer`, also the rows changed here after the server's copy.
 */
export function collectUnsyncedRowIds<T extends SyncRow>(local: T[], remote: T[], newer: boolean) {
  const remoteById = new Map(remote.map((row) => [row.id, row]))
  const ids: string[] = []
  for (const row of local) {
    const remoteRow = remoteById.get(row.id)
    if (!remoteRow || (newer && time(row.updated_at) > time(remoteRow.updated_at))) {
      ids.push(row.id)
    }
  }
  return ids
}

/** Never moves backwards, or the overlap would walk it down a window at a time. */
export function nextSyncCursor(rows: { updated_at: Date | string }[], previous?: string) {
  const max = rows.reduce((value, row) => Math.max(value, time(row.updated_at)), 0)
  if (!max) return previous
  return new Date(Math.max(max - SYNC_CURSOR_OVERLAP_MS, time(previous))).toISOString()
}

/** Newest first, as the library shows them. */
export function sortRows<T extends SyncRow>(rows: T[]) {
  return [...rows].sort((a, b) => time(b.created_at) - time(a.created_at))
}
