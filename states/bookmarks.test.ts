import { describe, expect, it } from 'bun:test'
import { bookmarks$, newBookmark, removeBookmark } from './bookmarks'
import { runUndoAction } from './undo-toast'

describe('bookmarks$', () => {
  it('restores only the requested removed bookmarks', () => {
    const restored = newBookmark({ url: 'https://www.youtube.com/watch?v=restore1234' })
    const leftRemoved = newBookmark({ url: 'https://www.youtube.com/watch?v=removed1234' })
    bookmarks$.addBookmark(restored)
    bookmarks$.addBookmark(leftRemoved)
    bookmarks$.toggleBookmark(restored)
    bookmarks$.toggleBookmark(leftRemoved)

    bookmarks$.restoreByIds([restored.id])

    expect(bookmarks$.bookmarks.get().find((x) => x.id === restored.id)?.json.deleted).toBe(false)
    expect(bookmarks$.bookmarks.get().find((x) => x.id === leftRemoved.id)?.json.deleted).toBe(true)
  })

  it('removes and restores the stored bookmark resolved by URL', () => {
    const stored = newBookmark({ url: 'https://www.youtube.com/watch?v=resolved123' })
    bookmarks$.addBookmark(stored)

    removeBookmark({ ...stored, id: 'stale-id' })
    expect(bookmarks$.bookmarks.get().find((x) => x.id === stored.id)?.json.deleted).toBe(true)

    runUndoAction()
    expect(bookmarks$.bookmarks.get().find((x) => x.id === stored.id)?.json.deleted).toBe(false)
  })

  it('does not add a bookmark when removing an unknown URL', () => {
    const unknown = newBookmark({ url: 'https://www.youtube.com/watch?v=unknown123' })
    const size = bookmarks$.bookmarks.length

    removeBookmark(unknown)

    expect(bookmarks$.bookmarks.length).toBe(size)
  })

  it('removes a malformed stored URL safely when its id matches', () => {
    const malformed = newBookmark({ url: '' })
    malformed.url = 'not a url'
    bookmarks$.bookmarks.unshift(malformed)

    removeBookmark(malformed)

    expect(bookmarks$.bookmarks.get().find((x) => x.id === malformed.id)?.json.deleted).toBe(true)
    runUndoAction()
  })

  it('uses an active URL match when a stale id is passed', () => {
    const url = 'https://www.youtube.com/watch?v=duplicate12'
    const removed = newBookmark({ url, json: { deleted: true } })
    const active = newBookmark({ url })
    bookmarks$.bookmarks.unshift(removed, active)

    removeBookmark({ ...active, id: 'missing-id' })

    expect(bookmarks$.bookmarks.get().find((x) => x.id === removed.id)?.json.deleted).toBe(true)
    expect(bookmarks$.bookmarks.get().find((x) => x.id === active.id)?.json.deleted).toBe(true)
    runUndoAction()
  })

  it('moves a bookmark without overwriting newer fields', () => {
    const bookmark = newBookmark({ url: 'https://www.youtube.com/watch?v=move123456' })
    bookmarks$.addBookmark(bookmark)
    bookmarks$.saveBookmark({ ...bookmark, title: 'Enriched title', json: { ...bookmark.json, thumbnail: 'new.jpg' } })

    bookmarks$.moveToFolder(bookmark.id, 'folder-id')

    const moved = bookmarks$.bookmarks.get().find((x) => x.id === bookmark.id)
    expect(moved?.title).toBe('Enriched title')
    expect(moved?.json.thumbnail).toBe('new.jpg')
    expect(moved?.json.folder).toBe('folder-id')
  })
})
