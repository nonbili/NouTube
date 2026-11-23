import { afterEach, describe, expect, it } from 'bun:test'
import { downloads$, failDownload, type DownloadPhase } from './downloads'

const url = 'https://www.youtube.com/watch?v=abcdefghijk'
const entry = (phase: DownloadPhase = 'downloading') => ({
  url, title: 'Example', phase, progress: 0, progressLine: '', errorMsg: '', savedPath: '',
})

afterEach(() => downloads$.set({}))

describe('download call failures', () => {
  it('leaves the downloading state when setup rejects without a progress event', () => {
    downloads$[url].set(entry())
    failDownload(url, 'Failed to download yt-dlp: 503 Service Unavailable')
    expect(downloads$[url].phase.get()).toBe('error')
    expect(downloads$[url].errorMsg.get()).toContain('503 Service Unavailable')
  })

  it('preserves the detailed error received through a progress event', () => {
    downloads$[url].set({ ...entry('error'), errorMsg: 'Requested format is not available' })
    failDownload(url, 'yt-dlp exited with code 1')
    expect(downloads$[url].errorMsg.get()).toBe('Requested format is not available')
  })

  it('does not overwrite a completed download or recreate a dismissed entry', () => {
    downloads$[url].set({ ...entry('done'), savedPath: '/tmp/example.mp4', progress: 100 })
    failDownload(url, 'late rejection')
    expect(downloads$[url].phase.get()).toBe('done')
    expect(downloads$[url].savedPath.get()).toBe('/tmp/example.mp4')
    downloads$[url].delete()
    failDownload(url, 'late rejection')
    expect(downloads$[url].get()).toBeUndefined()
  })
})
