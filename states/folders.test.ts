import { describe, expect, it } from 'bun:test'
import { folders$, newFolder } from './folders'

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
