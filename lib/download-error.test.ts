import { describe, expect, test } from 'bun:test'
import { describeDownloadError } from './download-error'

const REAL_403 = `WARNING: [youtube] No supported JavaScript runtime could be found. Only deno is enabled by default; to use another runtime add  --js-runtimes RUNTIME[:PATH]  to your command/config. YouTube extraction without a JS runtime has been deprecated, and some formats may be missing. See  https://github.com/yt-dlp/yt-dlp/wiki/EJS  for details on installing one
ERROR: unable to download video data: HTTP Error 403: Forbidden
`

describe('describeDownloadError', () => {
  test('picks the ERROR line over the warnings around it', () => {
    expect(describeDownloadError(REAL_403).detail).toBe('unable to download video data: HTTP Error 403: Forbidden')
  })

  test('maps a 403 to the blocked message', () => {
    expect(describeDownloadError(REAL_403).messageKey).toBe('modals.downloadErrorBlocked')
  })

  test('maps the bot check and members-only videos to the cookies message', () => {
    expect(
      describeDownloadError('ERROR: [youtube] abc: Sign in to confirm you are not a bot. Use --cookies').messageKey,
    ).toBe('modals.downloadErrorSignIn')
    expect(
      describeDownloadError('ERROR: [youtube] abc: Join this channel to get access to members-only content').messageKey,
    ).toBe('modals.downloadErrorSignIn')
  })

  test('maps a stale format pick', () => {
    expect(describeDownloadError('ERROR: [youtube] abc: Requested format is not available').messageKey).toBe(
      'modals.downloadErrorFormat',
    )
  })

  test('maps network failures', () => {
    expect(describeDownloadError('ERROR: unable to download video data: [Errno 8] getaddrinfo failed').messageKey).toBe(
      'modals.downloadErrorNetwork',
    )
  })

  test('leaves an unrecognised failure to its own text', () => {
    const result = describeDownloadError('ERROR: Postprocessing: Conversion failed!')
    expect(result.messageKey).toBeUndefined()
    expect(result.detail).toBe('Postprocessing: Conversion failed!')
  })

  test('falls back to the last non-warning line when nothing is prefixed with ERROR', () => {
    expect(describeDownloadError('WARNING: something\n[download] 12% of 3MiB\n').detail).toBe('[download] 12% of 3MiB')
    expect(describeDownloadError('').detail).toBe('')
  })
})
