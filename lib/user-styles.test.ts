import { describe, expect, it } from 'bun:test'
import {
  getEnabledUserStyleCss,
  matchesHostGlob,
  normalizeUserStyles,
} from './user-styles'

describe('user styles', () => {
  it('matches wildcard host globs', () => {
    expect(matchesHostGlob('m.youtube.com', '*.youtube.com')).toBe(true)
    expect(matchesHostGlob('youtube.com', '*.youtube.com')).toBe(false)
  })

  it('includes enabled builtin css for matching hosts', () => {
    const css = getEnabledUserStyleCss(
      'm.youtube.com',
      normalizeUserStyles({
        builtins: {
          'hide-mix-playlist': { enabled: true },
          'hide-shorts-navbar': { enabled: true },
        },
      }),
    )

    expect(css).toContain('ytm-compact-radio-renderer')
    expect(css).toContain('.pivot-shorts')
  })

  it('filters out invalid custom styles', () => {
    const snapshot = normalizeUserStyles({
      customStyles: [
        { name: 'bad', enabled: true, hostGlobs: ['https://m.youtube.com'], css: 'body { color: red; }' } as any,
        { name: 'ok', enabled: true, hostGlobs: ['m.youtube.com'], css: 'body { color: red; }' } as any,
      ],
    })

    expect(snapshot.customStyles).toHaveLength(1)
    expect(snapshot.customStyles[0].name).toBe('ok')
  })
})
