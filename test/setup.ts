import { mock } from 'bun:test'

// Native modules can't be loaded by bun (react-native's entrypoint uses Flow
// syntax), so state modules that persist via MMKV need these stubs.

mock.module('react-native-get-random-values', () => ({}))

mock.module('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: Record<string, unknown>) => obj?.android ?? obj?.native ?? obj?.default,
  },
  Alert: { alert: () => {} },
}))

class MMKVStub {
  private map = new Map<string, string>()

  getString(key: string) {
    return this.map.get(key)
  }

  set(key: string, value: string) {
    this.map.set(key, value)
  }

  delete(key: string) {
    this.map.delete(key)
  }

  getAllKeys() {
    return [...this.map.keys()]
  }

  contains(key: string) {
    return this.map.has(key)
  }
}

mock.module('react-native-mmkv', () => ({ MMKV: MMKVStub }))
