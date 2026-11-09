import { describe, expect, it } from 'bun:test'
import { mergeKeys, mergeList, mergeValue } from './merge'

describe('mergeValue', () => {
  it('keeps a change made on one side only', () => {
    expect(mergeValue(1, 2, 1)).toEqual({ value: 2, lost: false })
    expect(mergeValue(1, 1, 3)).toEqual({ value: 3, lost: false })
  })

  it('takes the other device when both changed, and says what was here is lost', () => {
    expect(mergeValue(1, 2, 3)).toEqual({ value: 3, lost: true })
  })

  it('takes the other device without a base, losing nothing when both agree', () => {
    expect(mergeValue(undefined, 2, 3)).toEqual({ value: 3, lost: true })
    expect(mergeValue(undefined, 2, 2)).toEqual({ value: 2, lost: false })
  })
})

describe('mergeKeys', () => {
  it('keeps changes to different keys from both sides', () => {
    const base = { theme: 'dark', zoom: 100, tabs: false }
    expect(mergeKeys(base, { ...base, theme: 'light' }, { ...base, zoom: 125 })).toEqual({
      value: { theme: 'light', zoom: 125, tabs: false },
      lost: false,
    })
  })

  it('keeps a key added on one side', () => {
    expect(mergeKeys<Record<string, number>>({ a: 1 }, { a: 1, b: 2 }, { a: 1 })).toEqual({
      value: { a: 1, b: 2 },
      lost: false,
    })
  })

  it('uses the merger of a key', () => {
    const base = { styles: { a: true, b: true } }
    const result = mergeKeys(base, { styles: { a: false, b: true } }, { styles: { a: true, b: false } }, {
      styles: (b, l, r) => mergeKeys(b, l, r),
    })
    expect(result).toEqual({ value: { styles: { a: false, b: false } }, lost: false })
  })
})

describe('mergeList', () => {
  const merge = mergeList((item: { url: string; title?: string }) => item.url)
  const a = { url: 'a' }
  const b = { url: 'b' }
  const c = { url: 'c' }

  it('keeps additions from both sides, the other device first', () => {
    expect(merge([a], [a, b], [a, c])).toEqual({ value: [a, c, b], lost: false })
  })

  it('drops an item taken away on one side and left alone on the other', () => {
    expect(merge([a, b], [a], [a, b])).toEqual({ value: [a], lost: false })
    expect(merge([a, b], [a, b], [a])).toEqual({ value: [a], lost: false })
  })

  it('keeps an item the other device changed after it was taken away here, as lost', () => {
    const renamed = { url: 'b', title: 'B' }
    expect(merge([a, b], [a], [a, renamed])).toEqual({ value: [a, renamed], lost: true })
  })

  it('drops an item changed here after the other device took it away, as lost', () => {
    expect(merge([a, b], [a, { url: 'b', title: 'B' }], [a])).toEqual({ value: [a], lost: true })
  })

  it('merges an item changed on both sides like a value', () => {
    expect(merge([b], [{ url: 'b', title: 'mine' }], [{ url: 'b', title: 'theirs' }])).toEqual({
      value: [{ url: 'b', title: 'theirs' }],
      lost: true,
    })
  })

  it('unions both sides without a base and collapses duplicates', () => {
    expect(merge(undefined, [a, b, b], [c, a])).toEqual({ value: [c, a, b], lost: false })
  })
})

describe('key order', () => {
  it('takes objects with the same keys in another order as unchanged', () => {
    const merge = mergeList((item: { url: string; title?: string; icon?: string }) => item.url)
    // As sent, then as the server gives it back.
    const sent = { url: 'a', title: 'A', icon: 'i' }
    const returned = { icon: 'i', title: 'A', url: 'a' }
    expect(merge([sent], [], [returned])).toEqual({ value: [], lost: false })
    expect(mergeKeys({ a: { x: 1, y: 2 } }, { a: { x: 3, y: 2 } }, { a: { y: 2, x: 1 } })).toEqual({
      value: { a: { x: 3, y: 2 } },
      lost: false,
    })
  })
})

describe('documents from another version of the app', () => {
  it('keeps what the other version does not write, without failing', () => {
    const base = { builtins: { a: true }, builtinScripts: { s: true }, customScripts: [{ id: '1' }] }
    const local = { builtins: { a: false }, builtinScripts: { s: false }, customScripts: [{ id: '1' }, { id: '2' }] }
    // Written by a version that knows neither builtinScripts nor customScripts.
    const remote = { builtins: { a: true } } as typeof base
    const result = mergeKeys(base, local, remote, {
      builtins: (b, l, r) => mergeKeys(b, l, r),
      builtinScripts: (b, l, r) => mergeKeys(b, l, r),
      customScripts: mergeList((script) => script.id),
    })
    expect(result).toEqual({ value: local, lost: false })
  })
})
