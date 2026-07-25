import pp from 'papaparse'
import { bookmarks$ } from '@/states/bookmarks'
import { folders$ } from '@/states/folders'

export const BOOKMARKS_CSV_HEADER = ['url', 'title', 'folder', 'tab', 'thumbnail', 'channel_id'] as const

/**
 * Export bookmarks as CSV. Folders are exported by name plus the tab they
 * belong to, so `importBookmarksCsv` can recreate them.
 */
export function exportBookmarksCsv(): string {
  const folders = new Map(folders$.folders.get().map((x) => [x.id, x]))
  const rows = bookmarks$.bookmarks
    .get()
    .filter((x) => !x.json.deleted)
    .map((x) => {
      const folder = x.json.folder ? folders.get(x.json.folder) : undefined
      const visibleFolder = folder && !folder.json.deleted ? folder : undefined
      return [
        x.url,
        x.title || '',
        visibleFolder?.name || '',
        visibleFolder?.json.tab || '',
        x.json.thumbnail || x.thumbnail || '',
        x.json.id || '',
      ]
    })
  return pp.unparse([[...BOOKMARKS_CSV_HEADER], ...rows])
}
