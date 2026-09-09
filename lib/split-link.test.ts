import { describe, expect, it } from 'bun:test'
import { findSplitLink } from '../content/split-link'

const eventWithPath = (...path: unknown[]) => ({
  composedPath: () => path,
  target: path[0],
}) as Pick<MouseEvent, 'composedPath' | 'target'>

describe('split navigation links', () => {
  it('recognizes the mobile Home button when its nested logo is tapped', () => {
    const event = eventWithPath(
      { tagName: 'path' },
      { tagName: 'svg' },
      { tagName: 'BUTTON' },
      { tagName: 'YTM-HOME-LOGO' },
    )
    expect(findSplitLink(event)).toEqual({ href: '/' })
  })

  it('preserves a normal link and its target', () => {
    const event = eventWithPath(
      { tagName: 'IMG' },
      { tagName: 'A', getAttribute: () => '/watch?v=abc123', target: '_blank' },
    )
    expect(findSplitLink(event)).toEqual({ href: '/watch?v=abc123', target: '_blank' })
  })

  it('leaves ordinary player buttons alone', () => {
    expect(findSplitLink(eventWithPath({ tagName: 'BUTTON' }, { tagName: 'DIV' }))).toBeNull()
  })
})
