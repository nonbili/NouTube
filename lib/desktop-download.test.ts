import { describe, expect, it } from 'bun:test'
import { fileURLToPath } from 'node:url'

function run(mode: string) {
  const result = Bun.spawnSync([
    process.execPath, '--tsconfig-override', fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
    fileURLToPath(new URL('../test/desktop-download.ts', import.meta.url)), mode,
  ])
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return JSON.parse(result.stdout.toString().trim().split('\n').at(-1)!) as {
    error: string
    progress: { done: boolean; error?: boolean; line: string; filePath?: string }[]
  }
}

describe('desktop download lifecycle', () => {
  it('rejects a missing executable without an unhandled process error', () => {
    const result = run('missing')
    expect(result.error).toContain('Failed to run yt-dlp:')
    expect(result.progress.filter((event) => event.done)).toHaveLength(1)
    expect(result.progress.at(-1)).toMatchObject({ done: true, error: true, line: result.error })
  })

  it('propagates setup failures to the caller for the UI fallback', () => {
    expect(run('setup').error).toContain('503 Service Unavailable')
  })

  it('still reports successful downloads with their saved path', () => {
    const result = run('success')
    expect(result.error).toBe('')
    expect(result.progress.at(-1)).toMatchObject({ done: true, error: false, filePath: '/tmp/example.mp4' })
  })

  it('keeps the yt-dlp failure details in the final progress event', () => {
    const result = run('failure')
    expect(result.error).toBe('yt-dlp exited with code 1')
    expect(result.progress.at(-1)).toMatchObject({ done: true, error: true })
    expect(result.progress.at(-1)!.line).toContain('Requested format is not available')
  })
})
