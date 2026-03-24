import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import {
  builtinUserStyleIds,
  createDefaultUserStylesSnapshot,
  createNormalizedCustomUserStyle,
  normalizeUserStyles,
  USER_STYLES_SCHEMA_VERSION,
  type BuiltinUserStyleId,
  type CustomUserStyle,
  type UserStylesSnapshot,
} from '@/lib/user-styles'

interface Store extends UserStylesSnapshot {
  toggleBuiltin: (id: BuiltinUserStyleId) => void
  setBuiltinEnabled: (id: BuiltinUserStyleId, enabled: boolean) => void
  addCustomStyle: (input: Omit<CustomUserStyle, 'id'>) => string
  updateCustomStyle: (id: string, input: Omit<CustomUserStyle, 'id'>) => void
  toggleCustomStyle: (id: string) => void
  deleteCustomStyle: (id: string) => void
}

export const userStyles$ = observable<Store>({
  ...createDefaultUserStylesSnapshot(),

  toggleBuiltin: (id) => {
    const enabled = userStyles$.builtins[id].enabled.get()
    userStyles$.builtins[id].enabled.set(!enabled)
  },

  setBuiltinEnabled: (id, enabled) => {
    userStyles$.builtins[id].enabled.set(enabled)
  },

  addCustomStyle: (input) => {
    const next = createNormalizedCustomUserStyle(input, userStyles$.customStyles.get().length)
    if (!next) {
      return ''
    }
    userStyles$.customStyles.push(next)
    return next.id
  },

  updateCustomStyle: (id, input) => {
    const styles = userStyles$.customStyles.get()
    const index = styles.findIndex((style) => style?.id === id)
    if (index === -1) {
      return
    }

    const next = createNormalizedCustomUserStyle({ ...input, id }, index)
    if (!next) {
      return
    }

    userStyles$.customStyles[index].set(next)
  },

  toggleCustomStyle: (id) => {
    const styles = userStyles$.customStyles.get()
    const index = styles.findIndex((style) => style?.id === id)
    if (index === -1) {
      return
    }

    const enabled = userStyles$.customStyles[index].enabled.get()
    userStyles$.customStyles[index].enabled.set(!enabled)
  },

  deleteCustomStyle: (id) => {
    const styles = userStyles$.customStyles.get()
    const index = styles.findIndex((style) => style?.id === id)
    if (index === -1) {
      return
    }
    userStyles$.customStyles.splice(index, 1)
  },
})

export const getUserStylesSnapshot = (value: Partial<Store> | undefined = userStyles$.get()): UserStylesSnapshot => ({
  schemaVersion:
    typeof value?.schemaVersion === 'number' ? value.schemaVersion : USER_STYLES_SCHEMA_VERSION,
  builtins: builtinUserStyleIds.reduce(
    (acc, id) => {
      acc[id] = {
        enabled: typeof value?.builtins?.[id]?.enabled === 'boolean' ? value.builtins[id].enabled : true,
      }
      return acc
    },
    {} as UserStylesSnapshot['builtins'],
  ),
  customStyles: (value?.customStyles || []).map((style) => ({
    id: style.id,
    name: style.name,
    enabled: style.enabled,
    hostGlobs: [...style.hostGlobs],
    css: style.css,
  })),
})

syncObservable(userStyles$, {
  persist: {
    name: 'user-styles',
    plugin: ObservablePersistMMKV,
    transform: {
      load: (data: Store) => normalizeUserStyles(data),
    },
  },
})
