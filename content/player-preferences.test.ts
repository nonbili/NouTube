import { describe, expect, it } from 'bun:test'
import { fileURLToPath } from 'node:url'

function run(mode: string) {
  const result = Bun.spawnSync([
    process.execPath, '--tsconfig-override', fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
    fileURLToPath(new URL('../test/player-preferences.ts', import.meta.url)), mode,
  ])
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return JSON.parse(result.stdout.toString().trim().split('\n').at(-1)!) as {
    beforeResponse: { rates: number[]; qualities: string[] }
    rates: number[]; qualities: string[]; overlays: number
  }
}

describe('playback preferences with SponsorBlock enabled', () => {
  it('applies speed and quality before the request completes and tolerates a network failure', () => {
    const result = run('failure')
    expect(result.beforeResponse).toEqual({ rates: [1.5], qualities: ['hd720'] })
    expect(result.rates).toEqual([1.5])
    expect(result.qualities).toEqual(['hd720'])
    expect(result.overlays).toBe(0)
  })

  it('still renders sponsor segments when the request succeeds', () => {
    const result = run('success')
    expect(result.beforeResponse).toEqual({ rates: [1.5], qualities: ['hd720'] })
    expect(result.overlays).toBe(1)
  })

  it('does not render a late response after the player has been removed', () => {
    expect(run('stale').overlays).toBe(0)
  })
})
