import { describe, expect, it } from 'bun:test'
import { installSplitPlayerWindow } from '../content/split-player-window'

describe('split player window dimensions', () => {
  it('keeps the outer window full size while shrinking and expanding the viewport', () => {
    const target = {
      screen: { width: 393, height: 808 },
      innerWidth: 393,
      innerHeight: 710,
      get outerWidth() { return this.innerWidth },
      get outerHeight() { return this.innerHeight },
    }
    installSplitPlayerWindow(target as unknown as Window)
    target.innerWidth = 227
    target.innerHeight = 128

    expect([target.outerWidth, target.outerHeight]).toEqual([393, 808])
    expect([target.innerWidth, target.innerHeight]).toEqual([227, 128])

    target.innerWidth = 393
    target.innerHeight = 710
    expect([target.outerWidth, target.outerHeight]).toEqual([393, 808])
    expect([target.innerWidth, target.innerHeight]).toEqual([393, 710])
  })

  it('tracks screen rotation without retaining the old window area', () => {
    const target = { screen: { width: 393, height: 808 } }
    installSplitPlayerWindow(target as unknown as Window)
    target.screen.width = 808
    target.screen.height = 393
    expect((target as unknown as Window).outerWidth).toBe(808)
    expect((target as unknown as Window).outerHeight).toBe(393)
  })
})
