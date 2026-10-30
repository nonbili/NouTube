const restoreKey = 'nou:autoplay-restore'
const toggleSelector = '.ytwAutonavToggleButtonHost, .ytp-autonav-toggle-button, ytm-autonav-toggle-button-renderer button, ytm-autonav-toggle-button-renderer [role="switch"]'
let clicking = false
const lastClicks = new WeakMap<object, number>()

// Use YouTube's own control: mobile's application-level countdown does not
// follow the player-only setAutonavState API. The saved preference survives a
// reload so removing our override can restore the user's original choice.
export function applyAutoplayPolicy(root: Pick<Document, 'querySelectorAll'>, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, disabled: boolean) {
  if (clicking) return
  if (!disabled && storage.getItem(restoreKey) === null) return
  for (const toggle of root.querySelectorAll<HTMLElement>(toggleSelector)) {
    const value = toggle.getAttribute('aria-checked') ?? toggle.getAttribute('aria-pressed')
    if (value !== 'true' && value !== 'false') continue
    const enabled = value === 'true'
    const original = storage.getItem(restoreKey)
    if (disabled && original === null) storage.setItem(restoreKey, value)
    const desired = disabled ? false : original === 'true' ? true : original === 'false' ? false : undefined
    if (desired === undefined) return
    if (enabled !== desired) {
      const now = Date.now()
      const last = lastClicks.get(toggle)
      if (last !== undefined && now - last < 1000) return
      lastClicks.set(toggle, now)
      clicking = true
      try { toggle.click() } finally { clicking = false }
      // The UI updates asynchronously. Keep the restoration marker until its
      // state confirms the click, including when a replacement control mounts.
      return
    }
    if (!disabled) storage.removeItem(restoreKey)
    return
  }
}
