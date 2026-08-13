import { describe, expect, it } from 'bun:test'
import { bookmarks$, newBookmark } from './bookmarks'
import { folders$, newFolder, removeFolder } from './folders'
import { runUndoAction } from './undo-toast'

describe('folders$', () => {
  it('makes a newly saved folder visible to consumers filtering by tab (#280)', () => {
    const folder = newFolder('watch', { name: 'Music' })
    folders$.saveFolder(folder)

    const visible = folders$.folders.get().filter((x) => !x.json.deleted && x.json.tab === 'watch')
    expect(visible.map((x) => x.id)).toContain(folder.id)
  })

  it('updates an existing folder in place instead of duplicating it', () => {
    const folder = newFolder('watch', { name: 'Old name' })
    folders$.saveFolder(folder)
    folders$.saveFolder({ ...folder, name: 'New name' })

    const matches = folders$.folders.get().filter((x) => x.id === folder.id)
    expect(matches).toHaveLength(1)
    expect(matches[0].name).toBe('New name')
  })

  it('marks removed folders as deleted', () => {
    const folder = newFolder('watch', { name: 'Doomed' })
    folders$.saveFolder(folder)
    folders$.removeFolder(folder)

    const saved = folders$.folders.get().find((x) => x.id === folder.id)
    expect(saved?.json.deleted).toBe(true)
  })

  it('restores a removed folder', () => {
    const folder = newFolder('watch', { name: 'Restored' })
    folders$.saveFolder(folder)
    folders$.removeFolder(folder)
    folders$.restoreFolder(folder)

    const saved = folders$.folders.get().find((x) => x.id === folder.id)
    expect(saved?.json.deleted).toBe(false)
  })

  it('undoes folder removal without reviving bookmarks deleted earlier', () => {
    const folder = newFolder('watch', { name: 'Undo folder' })
    const activeBookmark = newBookmark({
      url: 'https://www.youtube.com/watch?v=folderundo1',
      json: { folder: folder.id },
    })
    const previouslyRemovedBookmark = newBookmark({
      url: 'https://www.youtube.com/watch?v=folderundo2',
      json: { folder: folder.id, deleted: true },
    })
    folders$.saveFolder(folder)
    bookmarks$.addBookmark(activeBookmark)
    bookmarks$.bookmarks.unshift(previouslyRemovedBookmark)

    removeFolder(folder)
    runUndoAction()

    expect(folders$.folders.get().find((x) => x.id === folder.id)?.json.deleted).toBe(false)
    expect(bookmarks$.bookmarks.get().find((x) => x.id === activeBookmark.id)?.json.deleted).toBe(false)
    expect(bookmarks$.bookmarks.get().find((x) => x.id === previouslyRemovedBookmark.id)?.json.deleted).toBe(true)
  })

  it('reuses an existing folder with the same tab and name', () => {
    const first = folders$.getOrCreateFolder('channel', 'Creators')
    const second = folders$.getOrCreateFolder('channel', 'Creators')
    expect(second.id).toBe(first.id)
  })

  it('skips already imported folders', () => {
    const folder = newFolder('playlist', { name: 'Imported' })
    folders$.saveFolder(folder)

    folders$.importFolders([folder, newFolder('playlist', { name: 'Fresh' })])

    const matches = folders$.folders.get().filter((x) => x.id === folder.id)
    expect(matches).toHaveLength(1)
  })
})
