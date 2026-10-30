import { describe, expect, it, spyOn } from 'bun:test'
import { applyAutoplayPolicy } from '../content/autoplay'

function page(initial = true, attribute = 'aria-pressed') {
  let enabled = initial
  let mounted = true
  const calls: boolean[] = []
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  const toggle = {
    getAttribute: (key: string) => key === attribute ? String(enabled) : null,
    click: () => { enabled = !enabled; calls.push(enabled) },
  }
  const root = { querySelectorAll: () => mounted ? [toggle] : [] } as unknown as Document
  return { root, storage, calls, values, mount: (value: boolean) => { mounted = value } }
}

describe('recommendation autoplay policy', () => {
  for (const attribute of ['aria-pressed', 'aria-checked']) {
    it(`uses the native ${attribute} toggle and restores the original preference`, () => {
      const clock = spyOn(Date, 'now').mockReturnValue(10000)
      try {
      const p = page(true, attribute)
      applyAutoplayPolicy(p.root, p.storage, false)
      expect(p.calls).toEqual([])
      applyAutoplayPolicy(p.root, p.storage, true)
      applyAutoplayPolicy(p.root, p.storage, true)
      expect(p.calls).toEqual([false])
      clock.mockReturnValue(12000)
      applyAutoplayPolicy(p.root, p.storage, false)
      applyAutoplayPolicy(p.root, p.storage, false)
      expect(p.calls).toEqual([false, true])
      expect(p.values.size).toBe(0)
      } finally { clock.mockRestore() }
    })
  }

  it('does not enable autoplay that was already off', () => {
    const p = page(false)
    applyAutoplayPolicy(p.root, p.storage, true)
    applyAutoplayPolicy(p.root, p.storage, false)
    expect(p.calls).toEqual([])
    expect(p.values.size).toBe(0)
  })

  it('restores after page/player replacement using the persisted marker', () => {
    const p = page()
    applyAutoplayPolicy(p.root, p.storage, true)
    const replacement = page(false)
    applyAutoplayPolicy(replacement.root, p.storage, false)
    expect(replacement.calls).toEqual([true])
  })

  it('waits for controls to mount without losing the original choice', () => {
    const p = page()
    p.mount(false)
    applyAutoplayPolicy(p.root, p.storage, true)
    expect(p.values.size).toBe(0)
    p.mount(true)
    applyAutoplayPolicy(p.root, p.storage, true)
    expect(p.calls).toEqual([false])
  })

  it('does not repeatedly click a control that ignores clicks', () => {
    let clicks = 0
    const toggle = { getAttribute: () => 'true', click: () => { clicks++ } }
    const root = { querySelectorAll: () => [toggle] } as unknown as Document
    const p = page()
    applyAutoplayPolicy(root, p.storage, true)
    applyAutoplayPolicy(root, p.storage, true)
    expect(clicks).toBe(1)
  })
})
