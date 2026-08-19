import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import {
  builtinUserStyleIds,
  createDefaultUserStylesSnapshot,
  createNormalizedCustomUserScript,
  createNormalizedCustomUserStyle,
  normalizeUserStyles,
  USER_STYLES_SCHEMA_VERSION,
  type BuiltinUserStyleId,
  type CustomUserScript,
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
  addCustomScript: (input: Omit<CustomUserScript, 'id'>) => string
  updateCustomScript: (id: string, input: Omit<CustomUserScript, 'id'>) => void
  toggleCustomScript: (id: string) => void
  deleteCustomScript: (id: string) => void
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

  addCustomScript: (input) => {
    const next = createNormalizedCustomUserScript(input, userStyles$.customScripts.get().length)
    if (!next) {
      return ''
    }
    userStyles$.customScripts.push(next)
    return next.id
  },

  updateCustomScript: (id, input) => {
    const scripts = userStyles$.customScripts.get()
    const index = scripts.findIndex((script) => script?.id === id)
    if (index === -1) {
      return
    }

    const next = createNormalizedCustomUserScript({ ...input, id }, index)
    if (!next) {
      return
    }

    userStyles$.customScripts[index].set(next)
  },

  toggleCustomScript: (id) => {
    const scripts = userStyles$.customScripts.get()
    const index = scripts.findIndex((script) => script?.id === id)
    if (index === -1) {
      return
    }

    const enabled = userStyles$.customScripts[index].enabled.get()
    userStyles$.customScripts[index].enabled.set(!enabled)
  },

  deleteCustomScript: (id) => {
    const scripts = userStyles$.customScripts.get()
    const index = scripts.findIndex((script) => script?.id === id)
    if (index === -1) {
      return
    }
    userStyles$.customScripts.splice(index, 1)
  },
})

export const getUserStylesSnapshot = (value: Partial<Store> | undefined = userStyles$.get()): UserStylesSnapshot => ({
  schemaVersion: USER_STYLES_SCHEMA_VERSION,
  builtins: builtinUserStyleIds.reduce(
    (acc, id) => {
      acc[id] = {
        enabled: typeof value?.builtins?.[id]?.enabled === 'boolean' ? value.builtins[id].enabled : true,
      }
      return acc
    },
    {} as UserStylesSnapshot['builtins'],
  ),
  customStyles: (value?.customStyles || [])
    .filter((style): style is CustomUserStyle => Boolean(style))
    .map((style) => ({
      id: style.id,
      name: style.name,
      enabled: style.enabled,
      css: style.css,
    })),
  customScripts: (value?.customScripts || [])
    .filter((script): script is CustomUserScript => Boolean(script))
    .map((script) => ({
      id: script.id,
      name: script.name,
      enabled: script.enabled,
      pinToHeader: Boolean(script.pinToHeader),
      js: script.js,
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
