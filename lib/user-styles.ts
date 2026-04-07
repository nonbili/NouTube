export const USER_STYLES_SCHEMA_VERSION = 1

export const builtinUserStyleIds = ['hide-mix-playlist', 'hide-shorts-navbar'] as const

export type BuiltinUserStyleId = (typeof builtinUserStyleIds)[number]

export interface BuiltinUserStyleState {
  enabled: boolean
}

export interface CustomUserStyle {
  id: string
  name: string
  enabled: boolean
  css: string
}

export interface UserStylesSnapshot {
  schemaVersion: number
  builtins: Record<BuiltinUserStyleId, BuiltinUserStyleState>
  customStyles: CustomUserStyle[]
}

export interface BuiltinUserStyleDefinition {
  id: BuiltinUserStyleId
  labelKey: string
  css: string
}

const css = (raw: ArrayLike<string>, ...values: any[]) => String.raw({ raw }, ...values)
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const createId = (size = 6) => {
  let value = ''
  for (let index = 0; index < size; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return value
}

export const builtinUserStyleDefinitions: BuiltinUserStyleDefinition[] = [
  {
    id: 'hide-mix-playlist',
    labelKey: 'settings.userStyles.builtin.hideMixPlaylist.label',
    css: css`
      ytm-compact-radio-renderer:has(yt-collections-stack),
      ytm-compact-playlist-renderer:has(yt-collections-stack),
      ytm-rich-item-renderer:has(yt-collections-stack) {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-shorts-navbar',
    labelKey: 'settings.userStyles.builtin.hideShortsInNavbar.label',
    css: css`
      ytm-pivot-bar-item-renderer:has(.pivot-shorts) {
        display: none !important;
      }
    `,
  },
]

export const builtinUserStyleDefinitionById = builtinUserStyleDefinitions.reduce(
  (acc, definition) => {
    acc[definition.id] = definition
    return acc
  },
  {} as Record<BuiltinUserStyleId, BuiltinUserStyleDefinition>,
)

export const createDefaultBuiltinUserStyles = (): Record<BuiltinUserStyleId, BuiltinUserStyleState> => ({
  'hide-mix-playlist': { enabled: false },
  'hide-shorts-navbar': { enabled: false },
})

export const createDefaultUserStylesSnapshot = (): UserStylesSnapshot => ({
  schemaVersion: USER_STYLES_SCHEMA_VERSION,
  builtins: createDefaultBuiltinUserStyles(),
  customStyles: [],
})

export const getEnabledUserStyleCss = (host: string, snapshot?: UserStylesSnapshot) => {
  const userStyles = snapshot || createDefaultUserStylesSnapshot()
  const builtinCss = builtinUserStyleDefinitions
    .filter((definition) => userStyles.builtins[definition.id]?.enabled !== false)
    .map((definition) => definition.css.trim())
    .filter(Boolean)

  const customCss = (userStyles.customStyles || [])
    .filter((style) => style.enabled)
    .filter((style) => style.css.trim())
    .map((style) => style.css.trim())
    .filter(Boolean)

  return [...builtinCss, ...customCss].join('\n\n')
}

const normalizeCustomUserStyle = (
  style: Partial<CustomUserStyle> | null | undefined,
  index: number,
): CustomUserStyle | null => {
  if (!style) {
    return null
  }

  const css = typeof style.css === 'string' ? style.css.replace(/\s+$/, '') : ''
  if (!css.trim()) {
    return null
  }

  const name = typeof style.name === 'string' && style.name.trim() ? style.name.trim() : `Style ${index + 1}`

  return {
    id: typeof style.id === 'string' && style.id ? style.id : createId(6),
    name,
    enabled: typeof style.enabled === 'boolean' ? style.enabled : true,
    css,
  }
}

export const normalizeUserStyles = (data?: Partial<UserStylesSnapshot>): UserStylesSnapshot => {
  const defaults = createDefaultUserStylesSnapshot()
  const builtins = createDefaultBuiltinUserStyles()

  for (const id of builtinUserStyleIds) {
    builtins[id] = {
      enabled:
        typeof data?.builtins?.[id]?.enabled === 'boolean' ? data.builtins[id].enabled : defaults.builtins[id].enabled,
    }
  }

  const customStyles = (data?.customStyles || [])
    .map((style, index) => normalizeCustomUserStyle(style, index))
    .filter((style): style is CustomUserStyle => style != null)

  return {
    schemaVersion: USER_STYLES_SCHEMA_VERSION,
    builtins,
    customStyles,
  }
}

export const createNormalizedCustomUserStyle = (style: Partial<CustomUserStyle> | null | undefined, index: number) => {
  return normalizeCustomUserStyle(style, index)
}
