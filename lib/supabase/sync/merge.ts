/**
 * Three-way merges of a document changed both here and on another device since they last agreed
 * (`base`, absent when that is not known). A change made on one side only is kept; where both
 * sides changed the same thing, the other device's wins and `lost` tells the caller to keep a
 * backup of what was here.
 */

export interface MergeResult<T> {
  value: T
  lost: boolean
}

type Merger<T> = (base: T | undefined, local: T, remote: T) => MergeResult<T>

// Objects with their keys sorted: the server keeps JSON with its keys in an order of its own.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

/** The same JSON, whatever order the keys of its objects are in. */
export const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/** One value, taken whole. */
export const mergeValue = <T>(base: T | undefined, local: T, remote: T): MergeResult<T> => {
  if (same(local, remote)) return { value: remote, lost: false }
  if (base !== undefined && same(local, base)) return { value: remote, lost: false }
  if (base !== undefined && same(remote, base)) return { value: local, lost: false }
  return { value: remote, lost: true }
}

/** An object key by key; a key with a merger of its own is merged by it, any other is taken whole. */
export const mergeKeys = <T extends object>(
  base: T | undefined,
  local: T,
  remote: T,
  mergers: { [K in keyof T]?: Merger<T[K]> } = {},
): MergeResult<T> => {
  const value: Record<string, unknown> = {}
  let lost = false
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)])
  for (const key of keys) {
    const k = key as keyof T
    // Missing on one side: added on the other, or written by a version of the app that does not
    // know it. Either way it is kept; these documents never take a key away.
    if (remote[k] === undefined) {
      value[key] = local[k]
      continue
    }
    if (local[k] === undefined) {
      value[key] = remote[k]
      continue
    }
    const merge = (mergers[k] ?? mergeValue) as Merger<unknown>
    const result = merge(base?.[k], local[k], remote[k])
    lost ||= result.lost
    if (result.value !== undefined) value[key] = result.value
  }
  return { value: value as T, lost }
}

/**
 * A list of items told apart by `keyOf`. Items added on either side are kept, an item taken away
 * on one side and left as it was on the other goes. The order is the other device's, then what
 * was added here. Items of the same key after the first are dropped.
 */
export const mergeList = <T>(keyOf: (item: T) => string): Merger<T[]> => (base, local, remote) => {
  const index = (items: T[] | undefined) => {
    const map = new Map<string, T>()
    for (const item of items ?? []) {
      const key = keyOf(item)
      if (!map.has(key)) map.set(key, item)
    }
    return map
  }
  const baseItems = index(base)
  const localItems = index(local)
  const remoteItems = index(remote)
  const value: T[] = []
  let lost = false

  for (const [key, remoteItem] of remoteItems) {
    const localItem = localItems.get(key)
    const baseItem = baseItems.get(key)
    if (localItem === undefined) {
      // Taken away here: it goes unless the other device changed it meanwhile.
      if (baseItem !== undefined && same(baseItem, remoteItem)) continue
      if (baseItem !== undefined) lost = true
      value.push(remoteItem)
      continue
    }
    const result = mergeValue(baseItem, localItem, remoteItem)
    lost ||= result.lost
    value.push(result.value)
  }

  for (const [key, localItem] of localItems) {
    if (remoteItems.has(key)) continue
    const baseItem = baseItems.get(key)
    if (baseItem === undefined) {
      value.push(localItem)
    } else if (!same(baseItem, localItem)) {
      // Changed here, taken away on the other device: it stays taken away.
      lost = true
    }
  }

  return { value, lost }
}
