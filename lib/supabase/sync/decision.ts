export interface CollectionSyncDecisionInput {
  dirty: boolean
  hasRemoteItems: boolean
  remoteUpdatedAt?: string
  lastSyncedRemoteUpdatedAt?: string
  pushWhenRemoteMissing: boolean
  hasMeaningfulLocalValue: boolean
}

export interface CollectionSyncDecision {
  action: 'noop' | 'pull' | 'push'
  backupLocal: boolean
}

export function decideCollectionSync({
  dirty,
  hasRemoteItems,
  remoteUpdatedAt,
  lastSyncedRemoteUpdatedAt,
  pushWhenRemoteMissing,
  hasMeaningfulLocalValue,
}: CollectionSyncDecisionInput): CollectionSyncDecision {
  if (!hasRemoteItems) {
    if (lastSyncedRemoteUpdatedAt && !pushWhenRemoteMissing) {
      return { action: 'pull', backupLocal: dirty }
    }

    if (pushWhenRemoteMissing || dirty || hasMeaningfulLocalValue) {
      return { action: 'push', backupLocal: false }
    }

    return { action: 'noop', backupLocal: false }
  }

  if (!dirty) {
    if (remoteUpdatedAt !== lastSyncedRemoteUpdatedAt) {
      return { action: 'pull', backupLocal: false }
    }

    return { action: 'noop', backupLocal: false }
  }

  if (!lastSyncedRemoteUpdatedAt || remoteUpdatedAt !== lastSyncedRemoteUpdatedAt) {
    return { action: 'pull', backupLocal: true }
  }

  return { action: 'push', backupLocal: false }
}
