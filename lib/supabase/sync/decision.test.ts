import { describe, expect, it } from 'bun:test'
import { decideCollectionSync } from './decision'

describe('decideCollectionSync', () => {
  it('pushes initial local items when remote collection is empty', () => {
    expect(
      decideCollectionSync({
        dirty: true,
        hasRemoteItems: false,
        remoteUpdatedAt: undefined,
        lastSyncedRemoteUpdatedAt: undefined,
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toEqual({ action: 'push', backupLocal: false })
  })

  it('pulls remote rows when local state is clean and remote changed', () => {
    expect(
      decideCollectionSync({
        dirty: false,
        hasRemoteItems: true,
        remoteUpdatedAt: '2026-03-15T00:00:00.000Z',
        lastSyncedRemoteUpdatedAt: '2026-03-14T00:00:00.000Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toEqual({ action: 'pull', backupLocal: false })
  })

  it('pushes local changes when remote is unchanged since the last sync', () => {
    expect(
      decideCollectionSync({
        dirty: true,
        hasRemoteItems: true,
        remoteUpdatedAt: '2026-03-15T00:00:00.000Z',
        lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toEqual({ action: 'push', backupLocal: false })
  })

  it('backs up local rows and pulls remote when both sides diverged', () => {
    expect(
      decideCollectionSync({
        dirty: true,
        hasRemoteItems: true,
        remoteUpdatedAt: '2026-03-16T00:00:00.000Z',
        lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toEqual({ action: 'pull', backupLocal: true })
  })

  it('treats remote deletion after a previous sync as a pull, not a re-push', () => {
    expect(
      decideCollectionSync({
        dirty: false,
        hasRemoteItems: false,
        remoteUpdatedAt: undefined,
        lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00.000Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toEqual({ action: 'pull', backupLocal: false })
  })
})
