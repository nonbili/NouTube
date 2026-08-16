import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { toolbarPillLabelClass, toolbarPillPressableClass } from './toolbar-classes'

describe('toolbarPillPressableClass', () => {
  it('keeps the pill intrinsically sized on native', () => {
    const className = toolbarPillPressableClass(false)
    expect(className).toContain('min-w-11')
    expect(className).toContain('shrink-0')
    // `lg:` matches on wide tablets in NativeWind, so `lg:w-full` there would
    // stretch the pill across the toolbar and push the other buttons out.
    expect(className).not.toContain('lg:')
  })

  it('switches to the full-width vertical sidebar layout on web', () => {
    const className = toolbarPillPressableClass(true)
    expect(className).toContain('lg:w-full')
    expect(className).toContain('lg:min-w-0')
    expect(className).toContain('lg:px-0')
  })

  it('defaults to the native variant when running outside a browser', () => {
    expect(toolbarPillPressableClass()).toBe(toolbarPillPressableClass(false))
  })
})

describe('toolbarPillLabelClass', () => {
  it('drops the sidebar padding override on native', () => {
    const className = toolbarPillLabelClass(false)
    expect(className).toContain('rounded-full')
    expect(className).not.toContain('lg:')
  })

  it('tightens padding for the web sidebar', () => {
    expect(toolbarPillLabelClass(true)).toContain('lg:px-1.5')
  })

  it('defaults to the native variant when running outside a browser', () => {
    expect(toolbarPillLabelClass()).toBe(toolbarPillLabelClass(false))
  })
})

// Char ranges of every `nIf(isWeb, ...)` subtree, i.e. markup that never renders
// on native.
const webOnlyRanges = (source: string) => {
  const ranges: Array<[number, number]> = []
  for (const match of source.matchAll(/nIf\(\s*isWeb\s*,/g)) {
    const start = match.index + match[0].length
    let depth = 1
    let cursor = start
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '(') depth += 1
      else if (source[cursor] === ')') depth -= 1
      cursor += 1
    }
    ranges.push([start, cursor])
  }
  return ranges
}

describe('NouHeader breakpoint usage', () => {
  const source = readFileSync(new URL('./NouHeader.tsx', import.meta.url), 'utf8')

  it('finds the web-only subtrees it relies on', () => {
    expect(webOnlyRanges(source).length).toBeGreaterThan(0)
  })

  // Regression guard: every `lg:` literal in the shared header must be reachable
  // only on web, otherwise NativeWind also applies it on >=1024dp Android tablets.
  it('never uses an unguarded lg: class', () => {
    const ranges = webOnlyRanges(source)
    const unguarded = new Set<string>()

    for (const match of source.matchAll(/lg:/g)) {
      const index = match.index
      if (ranges.some(([start, end]) => index >= start && index < end)) continue
      // The enclosing clsx argument: class strings never contain `,` or `(`, so
      // the nearest one before the literal starts the condition guarding it.
      const argumentStart = Math.max(source.lastIndexOf(',', index), source.lastIndexOf('(', index)) + 1
      if (/isWeb\s*&&/.test(source.slice(argumentStart, index))) continue
      const lineStart = source.lastIndexOf('\n', index) + 1
      const lineEnd = source.indexOf('\n', index)
      const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd)
      unguarded.add(`${source.slice(0, index).split('\n').length}: ${line.trim()}`)
    }

    expect([...unguarded]).toEqual([])
  })
})
