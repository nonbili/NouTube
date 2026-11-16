import { describe, expect, test } from 'bun:test'
import { resolveVideoLinkTitle } from '../src/main/lib/link-title'

describe('desktop video link titles', () => {
  test('prefers the card title over thumbnail text and safely quotes the URL', async () => {
    const url = 'https://www.youtube.com/watch?v=abcdefghijk&label="quoted"'
    let script = ''
    const webContents = {
      executeJavaScript: async (source: string) => {
        script = source
        return 'A real video title'
      },
    }
    expect(await resolveVideoLinkTitle(webContents, url, 'LIVE')).toBe('A real video title')
    expect(script).toBe(`window.NouTube?.getVideoLinkTitle?.(${JSON.stringify(url)})`)
  })

  test('falls back to link text when no card title is available', async () => {
    for (const title of ['', '  ', undefined, null, 123]) {
      const webContents = { executeJavaScript: async () => title }
      expect(await resolveVideoLinkTitle(webContents, 'https://youtu.be/abcdefghijk', 'Link title')).toBe('Link title')
    }
  })

  test('falls back to link text when JavaScript evaluation fails', async () => {
    const webContents = {
      executeJavaScript: async () => { throw new Error('Page navigated away') },
    }
    expect(await resolveVideoLinkTitle(webContents, 'https://youtu.be/abcdefghijk', 'Link title')).toBe('Link title')
  })
})
