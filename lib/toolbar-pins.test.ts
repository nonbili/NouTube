import { describe, expect, it } from 'bun:test'
import { getDropSlot, pinMenuItem, sanitizePinnedMenuItems, slotToPinIndex, unpinMenuItem } from './toolbar-pins'

describe('sanitizePinnedMenuItems', () => {
  it('keeps known ids once, in order', () => {
    expect(sanitizePinnedMenuItems(['share', 'nope', 'switch-home', 'share', 3])).toEqual(['share', 'switch-home'])
  })

  it('falls back to an empty list', () => {
    expect(sanitizePinnedMenuItems(undefined)).toEqual([])
    expect(sanitizePinnedMenuItems('share')).toEqual([])
  })
})

describe('pinMenuItem', () => {
  it('inserts a new item at the index', () => {
    expect(pinMenuItem(['history', 'share'], 'switch-home', 1)).toEqual(['history', 'switch-home', 'share'])
  })

  it('clamps the index', () => {
    expect(pinMenuItem(['history'], 'share', 9)).toEqual(['history', 'share'])
    expect(pinMenuItem(['history'], 'share', -2)).toEqual(['share', 'history'])
  })

  it('moves an item already pinned', () => {
    expect(pinMenuItem(['history', 'share', 'reload'], 'history', 2)).toEqual(['share', 'reload', 'history'])
  })
})

describe('unpinMenuItem', () => {
  it('removes the item', () => {
    expect(unpinMenuItem(['history', 'share'], 'history')).toEqual(['share'])
  })
})

describe('getDropSlot', () => {
  it('snaps to the nearest slot boundary', () => {
    expect(getDropSlot(100, 100, 48, 3)).toBe(0)
    expect(getDropSlot(130, 100, 48, 3)).toBe(1)
    expect(getDropSlot(500, 100, 48, 3)).toBe(3)
    expect(getDropSlot(0, 100, 48, 3)).toBe(0)
  })

  it('returns 0 for an empty row', () => {
    expect(getDropSlot(300, 100, 48, 0)).toBe(0)
  })
})

describe('slotToPinIndex', () => {
  it('keeps slots for items coming from the menu', () => {
    expect(slotToPinIndex(2, -1)).toBe(2)
  })

  it('shifts slots after the item being moved', () => {
    expect(slotToPinIndex(3, 0)).toBe(2)
    expect(slotToPinIndex(0, 2)).toBe(0)
    // Dropping right after itself leaves it in place.
    expect(slotToPinIndex(1, 0)).toBe(0)
  })
})
