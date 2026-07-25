import { describe, expect, it } from 'bun:test'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { folders$, newFolder } from '@/states/folders'
import { exportBookmarksCsv } from './export'
import { importBookmarksCsv } from './import'

describe('bookmarks csv', () => {
  it('preserves folders through an export/import round trip', () => {
    const folder = newFolder('watch', { name: 'Live sets' })
    folders$.saveFolder(folder)
    bookmarks$.addBookmark(
      newBookmark({
        url: 'https://m.youtube.com/watch?v=aaaaaaaaaaa',
        title: 'A video',
        json: { folder: folder.id, thumbnail: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg' },
      }),
    )

    const csv = exportBookmarksCsv()

    // Wipe the local state, then import what we exported.
    bookmarks$.bookmarks.set([])
    folders$.folders.set([])
    importBookmarksCsv(csv)

    const imported = bookmarks$.bookmarks.get().find((x) => x.url.includes('aaaaaaaaaaa'))
    expect(imported).toBeDefined()
    expect(imported!.title).toBe('A video')
    expect(imported!.json.thumbnail).toBe('https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg')

    const newFolderId = imported!.json.folder
    expect(newFolderId).toBeDefined()
    const recreated = folders$.folders.get().find((x) => x.id === newFolderId)
    expect(recreated?.name).toBe('Live sets')
    expect(recreated?.json.tab).toBe('watch')
  })
})
