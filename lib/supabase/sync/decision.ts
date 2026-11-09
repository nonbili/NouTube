export interface DocumentSyncDecisionInput {
  dirty: boolean
  hasRemote: boolean
  remoteUpdatedAt?: string
  lastSyncedRemoteUpdatedAt?: string
  pushWhenRemoteMissing: boolean
  hasMeaningfulLocalValue: boolean
}

/**
 * - push: write what is here, on top of the row read (or of no row).
 * - pull: take the row read; nothing changed here.
 * - merge: both changed since they last agreed; put them together, then write that.
 */
export type DocumentSyncAction = 'noop' | 'pull' | 'push' | 'merge'

export function decideDocumentSync({
  dirty,
  hasRemote,
  remoteUpdatedAt,
  lastSyncedRemoteUpdatedAt,
  pushWhenRemoteMissing,
  hasMeaningfulLocalValue,
}: DocumentSyncDecisionInput): DocumentSyncAction {
  if (!hasRemote) {
    return pushWhenRemoteMissing || dirty || hasMeaningfulLocalValue ? 'push' : 'noop'
  }

  if (remoteUpdatedAt === lastSyncedRemoteUpdatedAt) {
    return dirty ? 'push' : 'noop'
  }

  return dirty ? 'merge' : 'pull'
}
