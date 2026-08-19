import { describe, expect, it } from 'bun:test'
import { getPastedUrl, isEditableTarget } from './paste-url'

describe('getPastedUrl', () => {
  it('accepts youtube urls and strips tracking params', () => {
    expect(getPastedUrl('  https://www.youtube.com/watch?v=abc&si=tracking ')).toBe(
      'https://www.youtube.com/watch?v=abc',
    )
  })

  it('accepts short and app links', () => {
    expect(getPastedUrl('https://youtu.be/abc')).toBe('https://youtu.be/abc')
    expect(getPastedUrl('noutube://www.youtube.com/watch?v=abc')).toBe('noutube://www.youtube.com/watch?v=abc')
  })

  it('ignores anything else', () => {
    expect(getPastedUrl('')).toBe('')
    expect(getPastedUrl('   ')).toBe('')
    expect(getPastedUrl('just some copied text')).toBe('')
    expect(getPastedUrl('https://example.com/watch?v=abc')).toBe('')
  })
})

describe('isEditableTarget', () => {
  it('detects text entry targets', () => {
    expect(isEditableTarget({ tagName: 'input' })).toBe(true)
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV' })).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
