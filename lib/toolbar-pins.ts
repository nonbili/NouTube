// Overflow menu entries the user can long-press and drag onto the toolbar
// (Android). The order here is only the validation set; the user's order is
// the one stored in settings.pinnedMenuItems.
export const pinnableMenuItems = [
  'switch-home',
  'history',
  'reload',
  'desktop-mode',
  'open-url',
  'share',
  'tools',
  'settings',
] as const

export type PinnableMenuItemId = (typeof pinnableMenuItems)[number]

export const isPinnableMenuItem = (value: unknown): value is PinnableMenuItemId =>
  typeof value === 'string' && (pinnableMenuItems as readonly string[]).includes(value)

export const sanitizePinnedMenuItems = (value: unknown): PinnableMenuItemId[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter(isPinnableMenuItem))]
}

/** Puts `id` at `index` of the list it leaves behind once removed from its old place. */
export const pinMenuItem = (list: readonly PinnableMenuItemId[], id: PinnableMenuItemId, index: number) => {
  const rest = list.filter((item) => item !== id)
  const at = Math.min(Math.max(0, Math.round(index)), rest.length)
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

export const unpinMenuItem = (list: readonly PinnableMenuItemId[], id: PinnableMenuItemId) =>
  list.filter((item) => item !== id)

/**
 * Slot (0..count) nearest to `x` in a row of `count` slots of width `slot`
 * starting at `start`: the boundary the dragged icon would be dropped on.
 */
export const getDropSlot = (x: number, start: number, slot: number, count: number) => {
  if (slot <= 0 || count <= 0) {
    return 0
  }
  return Math.min(Math.max(0, Math.round((x - start) / slot)), count)
}

/**
 * Index to pass to pinMenuItem for a drop on `slot`, given where the dragged
 * item sat in the row (-1 when it comes from the menu): slots after its old
 * place shift down by one once it is taken out.
 */
export const slotToPinIndex = (slot: number, fromIndex: number) =>
  fromIndex >= 0 && slot > fromIndex ? slot - 1 : slot
