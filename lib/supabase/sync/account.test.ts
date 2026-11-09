import { describe, expect, it } from 'bun:test'
import type { Bookmark } from '@/states/bookmarks'
import type { Folder } from '@/states/folders'
import { mergeDeviceRows } from './account'
import { foldBookmarksByUrl } from './bookmarks'

const at = (minute: number) => new Date(Date.UTC(2026, 10, 9, 0, minute))

const bookmark = (id: string, url: string, minute = 0, json: Bookmark['json'] = {}): Bookmark => ({
  id,
  url,
  title: id,
  json,
  created_at: at(minute),
  updated_at: at(minute),
})

const folder = (id: string, name: string, json: Partial<Folder['json']> = {}): Folder => ({
  id,
  name,
  json: { tab: 'yt', ...json },
  created_at: at(0),
  updated_at: at(0),
})

describe('foldBookmarksByUrl', () => {
  it('keeps the row the server has, with the content changed last', () => {
    const synced = bookmark('synced', 'https://x', 1, { folder: 'f1' })
    const local = bookmark('local', 'https://x', 5, { folder: 'f2' })

    const result = foldBookmarksByUrl([local, synced, bookmark('other', 'https://y')], (id) => id !== 'local')

    expect(result.rows.map((row) => row.id)).toEqual(['synced', 'other'])
    expect(result.rows[0].json.folder).toBe('f2')
    expect(result.rows[0].created_at).toEqual(at(1))
    expect(result.changed).toEqual(['synced'])
    expect(result.dropped).toEqual(['local'])
  })

  it('leaves rows of different urls alone', () => {
    const rows = [bookmark('a', 'https://a'), bookmark('b', 'https://b')]
    expect(foldBookmarksByUrl(rows, () => true)).toEqual({ rows, changed: [], dropped: [] })
  })
})

describe('mergeDeviceRows', () => {
  it('adds what only this device has under new ids, and points its bookmarks at the right folders', () => {
    let next = 0
    const newId = () => `new-${++next}`
    const result = mergeDeviceRows(
      [folder('lf-same', 'Music'), folder('lf-own', 'Talks'), folder('lf-gone', 'Old', { deleted: true })],
      [
        bookmark('lb-same', 'https://same', 0, { folder: 'lf-own' }),
        bookmark('lb-new', 'https://new', 0, { folder: 'lf-same' }),
        bookmark('lb-revived', 'https://revived', 0, { folder: 'lf-own' }),
        bookmark('lb-deleted', 'https://deleted-here', 0, { deleted: true }),
      ],
      [folder('rf-music', 'Music')],
      [bookmark('rb-same', 'https://same'), bookmark('rb-revived', 'https://revived', 0, { deleted: true })],
      newId,
    )

    expect(result.folders.map((row) => row.id)).toEqual(['rf-music', 'new-1'])
    expect(result.pendingFolderIds).toEqual(['new-1'])

    const byUrl = new Map(result.bookmarks.map((row) => [row.url, row]))
    expect(byUrl.get('https://same')?.id).toBe('rb-same')
    expect(byUrl.get('https://new')).toMatchObject({ id: 'new-2', json: { folder: 'rf-music' } })
    // The server keeps one row per url: the account's deleted row comes back instead of a new one.
    expect(byUrl.get('https://revived')).toMatchObject({ id: 'rb-revived', json: { folder: 'new-1', deleted: false } })
    expect(byUrl.has('https://deleted-here')).toBe(false)
    expect(result.pendingBookmarkIds.sort()).toEqual(['new-2', 'rb-revived'])
  })
})
