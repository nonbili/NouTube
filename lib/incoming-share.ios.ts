import { useIncomingShare as useExpoIncomingShare, getSharedPayloads } from 'expo-sharing'
import type { UseIncomingShareResult } from 'expo-sharing'

// The iOS share extension is only built once the app group it needs is
// registered with the Apple team (see app.config.ts). Without it every call
// into the module throws, and the throw in useIncomingShare's initial state
// would take the whole screen down -- so probe once, here, before any render.
const available = (() => {
  try {
    getSharedPayloads()
    return true
  } catch {
    return false
  }
})()

const empty: UseIncomingShareResult = {
  sharedPayloads: [],
  resolvedSharedPayloads: [],
  isResolving: false,
  error: null,
  clearSharedPayloads: () => {},
  refreshSharePayloads: async () => {},
}

export function useIncomingShare(): UseIncomingShareResult {
  // `available` is fixed for the life of the process, so the branch taken here
  // is stable and the hook order below it never changes.
  if (!available) {
    return empty
  }
  return useExpoIncomingShare()
}
