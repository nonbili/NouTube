import { describe, expect, it } from 'bun:test'
import {
  desktopShortcuts,
  createHistoryNavigationGate,
  formatShortcut,
  getAppCommandHistoryDirection,
  getMouseHistoryDirection,
  isHistoryDirection,
  matchShortcut,
} from './desktop-shortcuts'

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
  it('maps the mouse side buttons to back and forward', () => {
    expect(getMouseHistoryDirection(3)).toBe('back')
    expect(getMouseHistoryDirection(4)).toBe('forward')
  })

  it('ignores the other buttons', () => {
    for (const button of [0, 1, 2, 5]) {
      expect(getMouseHistoryDirection(button)).toBeNull()
    }
  })
})

describe('isHistoryDirection', () => {
  it('accepts only back and forward', () => {
    expect(isHistoryDirection('back')).toBe(true)
    expect(isHistoryDirection('forward')).toBe(true)
    expect(isHistoryDirection('reload')).toBe(false)
    expect(isHistoryDirection(undefined)).toBe(false)
  })
})

describe('getAppCommandHistoryDirection', () => {
  it('maps browser app commands to back and forward', () => {
    expect(getAppCommandHistoryDirection('browser-backward')).toBe('back')
    expect(getAppCommandHistoryDirection('browser-forward')).toBe('forward')
    expect(getAppCommandHistoryDirection('media-play-pause')).toBeNull()
  })
})

describe('createHistoryNavigationGate', () => {
  it('drops the same direction reported twice for one press', () => {
    const gate = createHistoryNavigationGate(300)
    expect(gate('back', 1000)).toBe(true)
    expect(gate('back', 1100)).toBe(false)
    expect(gate('back', 1400)).toBe(true)
  })

  it('lets a different direction through right away', () => {
    const gate = createHistoryNavigationGate(300)
    expect(gate('back', 1000)).toBe(true)
    expect(gate('forward', 1050)).toBe(true)
  })
})
