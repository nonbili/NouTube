import { describe, expect, it } from 'bun:test'
import { desktopShortcuts, formatShortcut, getMouseHistoryDirection, matchShortcut } from './desktop-shortcuts'

const ctrl = (key: string, extra: object = {}) => ({ key, control: true, ...extra })

describe('matchShortcut', () => {
  it('needs Ctrl on Linux/Windows and Cmd on macOS', () => {
    expect(matchShortcut(ctrl('b'), 'linux')?.action).toBe('library')
    expect(matchShortcut({ key: 'b', meta: true }, 'linux')).toBeNull()
    expect(matchShortcut({ key: 'b', meta: true }, 'darwin')?.action).toBe('library')
    expect(matchShortcut(ctrl('b'), 'darwin')).toBeNull()
    expect(matchShortcut({ key: 'b' }, 'linux')).toBeNull()
  })

  it('ignores Alt combinations and unknown keys', () => {
    expect(matchShortcut(ctrl('b', { alt: true }), 'linux')).toBeNull()
    expect(matchShortcut(ctrl('k'), 'linux')).toBeNull()
  })

  it('tells Ctrl+T from Ctrl+Shift+T, whatever the letter case', () => {
    expect(matchShortcut(ctrl('t'), 'linux')?.action).toBe('newTab')
    expect(matchShortcut(ctrl('T', { shift: true }), 'linux')?.action).toBe('reopenClosedTab')
    expect(matchShortcut(ctrl('B', { shift: true }), 'linux')).toBeNull()
  })

  it('maps digits to tab indexes', () => {
    expect(matchShortcut(ctrl('1'), 'linux')).toEqual({ action: 'selectTab', index: 0, skipWhenEditing: false })
    expect(matchShortcut(ctrl('9'), 'linux')?.index).toBe(8)
    expect(matchShortcut(ctrl('0'), 'linux')).toBeNull()
  })

  it('opens the shortcuts list with Ctrl+? or Ctrl+/', () => {
    expect(matchShortcut(ctrl('?', { shift: true }), 'linux')?.action).toBe('shortcuts')
    expect(matchShortcut(ctrl('/'), 'linux')?.action).toBe('shortcuts')
  })

  it('leaves letter shortcuts to text fields, but not tab or settings ones', () => {
    expect(matchShortcut(ctrl('b'), 'linux')?.skipWhenEditing).toBe(true)
    expect(matchShortcut(ctrl('h'), 'linux')?.skipWhenEditing).toBe(true)
    expect(matchShortcut(ctrl('w'), 'linux')?.skipWhenEditing).toBe(false)
    expect(matchShortcut(ctrl(','), 'linux')?.skipWhenEditing).toBe(false)
  })
})

describe('formatShortcut', () => {
  const reopen = desktopShortcuts.find((s) => s.action === 'reopenClosedTab')!
  it('formats per platform', () => {
    expect(formatShortcut(reopen, 'linux')).toBe('Ctrl+Shift+T')
    expect(formatShortcut(reopen, 'darwin')).toBe('⌘⇧T')
  })
})

describe('getMouseHistoryDirection', () => {
  it('navigates once when a side button is pressed and released', () => {
    for (const button of ['back', 'forward'] as const) {
      expect(getMouseHistoryDirection({ type: 'mouseDown', button })).toBeNull()
      expect(getMouseHistoryDirection({ type: 'mouseUp', button })).toBe(button)
    }
  })

  it('ignores the other buttons', () => {
    for (const button of ['left', 'middle', 'right', 'none', undefined]) {
      expect(getMouseHistoryDirection({ type: 'mouseUp', button })).toBeNull()
    }
  })
})
