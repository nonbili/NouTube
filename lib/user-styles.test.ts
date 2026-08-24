import { describe, expect, it } from 'bun:test'
import {
  USER_STYLES_SCHEMA_VERSION,
  buildUserScriptSources,
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
          'hide-ask-button': { enabled: false },
          'hide-home-feed': { enabled: false },
          'hide-related-videos': { enabled: false },
          'hide-end-screens': { enabled: false },
        },
      }),
    )

    expect(css).toContain('ytm-compact-radio-renderer')
    expect(css).toContain('.pivot-shorts')
  })

  it('keeps the distraction-free builtins off by default', () => {
    const snapshot = normalizeUserStyles()

    expect(snapshot.builtins['hide-home-feed'].enabled).toBe(false)
    expect(snapshot.builtins['hide-related-videos'].enabled).toBe(false)
    expect(snapshot.builtins['hide-end-screens'].enabled).toBe(false)

    const css = getEnabledUserStyleCss('m.youtube.com', snapshot)
    expect(css).not.toContain('ytp-endscreen-content')
  })

  it('includes the distraction-free builtins when enabled', () => {
    const snapshot = normalizeUserStyles({
      builtins: {
        'hide-home-feed': { enabled: true },
        'hide-related-videos': { enabled: true },
        'hide-end-screens': { enabled: true },
      } as any,
    })

    const css = getEnabledUserStyleCss('m.youtube.com', snapshot)
    expect(css).toContain("ytd-browse[page-subtype='home']")
    expect(css).toContain("[tab-identifier='FEwhat_to_watch']")
    expect(css).toContain('ytd-watch-next-secondary-results-renderer')
    expect(css).toContain('.ytp-endscreen-content')
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
  it('has no enabled scripts by default', () => {
    const snapshot = normalizeUserStyles()

    expect(getEnabledUserScripts(snapshot)).toHaveLength(0)
  })

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
    expect(parseUserscriptMetadata(source).runAt).toBe('document-end')
    expect(stripUserscriptMetadata(source)).toBe("console.log('hi')")
  })

  it('builds one injectable source per script and defers document-end ones', () => {
    const snapshot = normalizeUserStyles({
      customScripts: [
        { id: 'a', name: 'early', enabled: true, runAt: 'document-start', js: 'patchFetch()' } as any,
        { id: 'b', name: 'late', enabled: true, js: 'addBadge()' } as any,
        { id: 'c', name: 'off', enabled: false, js: 'never()' } as any,
      ],
    })

    const sources = buildUserScriptSources(snapshot)
    expect(sources).toHaveLength(2)
    // Separate units, so one malformed script cannot break the other.
    expect(sources[0]).toContain('patchFetch()')
    expect(sources[0]).toContain('false && document.readyState')
    expect(sources[1]).toContain('addBadge()')
    expect(sources[1]).toContain('true && document.readyState')
    // A pending script stands down once a newer sync bumps the generation, and
    // only marks itself as run when it actually runs.
    expect(sources[1]).toContain('if (state.gen !== gen || state.ran[id]) return')
    expect(sources[1].indexOf('state.ran[id] = true')).toBeGreaterThan(sources[1].indexOf('var run = function'))
    expect(sources.join('')).not.toContain('never()')
    expect(buildUserScriptSources(normalizeUserStyles({}))).toEqual([])
  })

  it('reads @run-at and defaults scripts to document-end', () => {
    const source = ['// ==UserScript==', '// @name   Early', '// @run-at document-start', '// ==/UserScript==', 'x()'].join(
      '\n',
    )

    expect(parseUserscriptMetadata(source).runAt).toBe('document-start')

    const snapshot = normalizeUserStyles({
      customScripts: [
        { id: 'a', name: 'early', enabled: true, runAt: 'document-start', js: 'x()' } as any,
        { id: 'b', name: 'legacy', enabled: true, js: 'y()' } as any,
      ],
    })

    expect(snapshot.customScripts[0].runAt).toBe('document-start')
    expect(snapshot.customScripts[1].runAt).toBe('document-end')
  })
})
