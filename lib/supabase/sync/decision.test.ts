import { describe, expect, it } from 'bun:test'
import { decideDocumentSync } from './decision'

describe('decideDocumentSync', () => {
  it('pushes when remote row is missing and the resource should always exist remotely', () => {
    expect(
      decideDocumentSync({
        dirty: false,
        hasRemote: false,
        remoteUpdatedAt: undefined,
        lastSyncedRemoteUpdatedAt: undefined,
        pushWhenRemoteMissing: true,
        hasMeaningfulLocalValue: true,
      }),
    ).toBe('push')
  })

  it('does nothing when bookmarks are empty and remote row is missing', () => {
    expect(
      decideDocumentSync({
        dirty: false,
        hasRemote: false,
        remoteUpdatedAt: undefined,
        lastSyncedRemoteUpdatedAt: undefined,
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: false,
      }),
    ).toBe('noop')
  })

  it('pulls remote state when local is clean and the remote row changed', () => {
    expect(
      decideDocumentSync({
        dirty: false,
        hasRemote: true,
        remoteUpdatedAt: '2026-03-15T00:00:00Z',
        lastSyncedRemoteUpdatedAt: '2026-03-14T00:00:00Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toBe('pull')
  })

  it('pushes local state when remote is unchanged since the last successful sync', () => {
    expect(
      decideDocumentSync({
        dirty: true,
        hasRemote: true,
        remoteUpdatedAt: '2026-03-15T00:00:00Z',
        lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toBe('push')
  })

  it('merges when both sides changed since they last agreed', () => {
    expect(
      decideDocumentSync({
        dirty: true,
        hasRemote: true,
        remoteUpdatedAt: '2026-03-16T00:00:00Z',
        lastSyncedRemoteUpdatedAt: '2026-03-15T00:00:00Z',
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toBe('merge')
  })

  it('merges on the first authenticated sync when a remote row exists and local changed', () => {
    expect(
      decideDocumentSync({
        dirty: true,
        hasRemote: true,
        remoteUpdatedAt: '2026-03-16T00:00:00Z',
        lastSyncedRemoteUpdatedAt: undefined,
        pushWhenRemoteMissing: false,
        hasMeaningfulLocalValue: true,
      }),
    ).toBe('merge')
  })
})
