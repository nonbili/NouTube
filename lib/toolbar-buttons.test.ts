import { describe, expect, it } from 'bun:test'
import {
  defaultToolbarButtonOrder,
  moveItem,
  sanitizeToolbarButtonOrder,
  sanitizeToolbarMenuButtons,
} from './toolbar-buttons'

describe('sanitizeToolbarButtonOrder', () => {
  it('falls back to the default order', () => {
    expect(sanitizeToolbarButtonOrder(undefined)).toEqual(defaultToolbarButtonOrder)
    expect(sanitizeToolbarButtonOrder('share')).toEqual(defaultToolbarButtonOrder)
  })

  it('keeps the stored order and appends missing ids', () => {
    const order = sanitizeToolbarButtonOrder(['share', 'nope', 'history', 'share', 3])
    expect(order.slice(0, 2)).toEqual(['share', 'history'])
    expect(order).toHaveLength(defaultToolbarButtonOrder.length)
    expect(new Set(order)).toEqual(new Set(defaultToolbarButtonOrder))
  })
})

describe('sanitizeToolbarMenuButtons', () => {
  it('keeps menu ids once', () => {
    expect(sanitizeToolbarMenuButtons(['share', 'history', 'share', 'tools'])).toEqual(['share', 'tools'])
    expect(sanitizeToolbarMenuButtons(null)).toEqual([])
  })
})

describe('moveItem', () => {
  it('moves forward and backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('clamps the target and ignores a bad source', () => {
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})
