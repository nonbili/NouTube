import { describe, expect, it } from 'bun:test'
import {
  USER_STYLES_SCHEMA_VERSION,
  getEnabledUserScripts,
  getEnabledUserStyleCss,
  normalizeUserStyles,
  parseUserscriptMetadata,
  stripUserscriptMetadata,
} from './user-styles'

describe('user styles', () => {
  it('includes enabled builtin css', () => {
    const css = getEnabledUserStyleCss(
      'm.youtube.com',
      normalizeUserStyles({
        builtins: {
          'hide-mix-playlist': { enabled: true },
          'hide-shorts-navbar': { enabled: true },
          'hide-community-posts': { enabled: false },
        },
      }),
    )

    expect(css).toContain('ytm-compact-radio-renderer')
    expect(css).toContain('.pivot-shorts')
  })

  it('filters out invalid custom styles', () => {
    const snapshot = normalizeUserStyles({
      customStyles: [
        { name: 'bad', enabled: true, css: '   ' } as any,
        { name: 'ok', enabled: true, css: 'body { color: red; }' } as any,
      ],
    })

    expect(snapshot.customStyles).toHaveLength(1)
    expect(snapshot.customStyles[0].name).toBe('ok')
  })
})

describe('user scripts', () => {
  it('filters out invalid custom scripts', () => {
    const snapshot = normalizeUserStyles({
      customScripts: [
        { name: 'empty', enabled: true, js: '   ' } as any,
        { name: 'ok', enabled: true, js: 'console.log(1)' } as any,
      ],
    })

    expect(snapshot.customScripts).toHaveLength(1)
    expect(snapshot.customScripts[0].name).toBe('ok')
    expect(snapshot.customScripts[0].pinToHeader).toBe(false)
  })

  it('returns only enabled, non-empty scripts', () => {
    const snapshot = normalizeUserStyles({
      customScripts: [
        { id: 'a', name: 'on', enabled: true, js: 'console.log(1)' } as any,
        { id: 'b', name: 'off', enabled: false, js: 'console.log(2)' } as any,
      ],
    })

    const enabled = getEnabledUserScripts(snapshot)
    expect(enabled).toHaveLength(1)
    expect(enabled[0].id).toBe('a')
  })

  it('preserves pinned script state and upgrades schema version', () => {
    const snapshot = normalizeUserStyles({
      schemaVersion: 1,
      customScripts: [
        { id: 'a', name: 'pinned', enabled: true, pinToHeader: true, js: 'console.log(1)' } as any,
        { id: 'b', name: 'legacy', enabled: true, js: 'console.log(2)' } as any,
      ],
    })

    expect(snapshot.schemaVersion).toBe(USER_STYLES_SCHEMA_VERSION)
    expect(snapshot.customScripts[0].pinToHeader).toBe(true)
    expect(snapshot.customScripts[1].pinToHeader).toBe(false)
  })

  it('parses and strips userscript metadata', () => {
    const source = [
      '// ==UserScript==',
      '// @name   My Script',
      '// @match  *://*.youtube.com/*',
      '// ==/UserScript==',
      "console.log('hi')",
    ].join('\n')

    expect(parseUserscriptMetadata(source).name).toBe('My Script')
    expect(stripUserscriptMetadata(source)).toBe("console.log('hi')")
  })
})
