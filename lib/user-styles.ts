export const USER_STYLES_SCHEMA_VERSION = 1

export const builtinUserStyleIds = ['hide-mix-playlist'] as const

export type BuiltinUserStyleId = (typeof builtinUserStyleIds)[number]

export interface BuiltinUserStyleState {
  enabled: boolean
}

export interface CustomUserStyle {
  id: string
  name: string
  enabled: boolean
  hostGlobs: string[]
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
  hostGlobs: string[]
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
    hostGlobs: ['m.youtube.com'],
    css: css`
      ytm-compact-radio-renderer:has(yt-collections-stack),
      ytm-compact-playlist-renderer:has(yt-collections-stack),
      ytm-rich-item-renderer:has(yt-collections-stack) {
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
})

export const createDefaultUserStylesSnapshot = (): UserStylesSnapshot => ({
  schemaVersion: USER_STYLES_SCHEMA_VERSION,
  builtins: createDefaultBuiltinUserStyles(),
  customStyles: [],
})

export const normalizeHostGlob = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized.includes('://') || normalized.includes('/') || /\s/.test(normalized)) {
    return ''
  }
  if (!/^[a-z0-9.*-]+$/.test(normalized)) {
    return ''
  }
  return normalized
}

export const sanitizeHostGlobs = (values?: string[]) => {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values || []) {
    const normalized = normalizeHostGlob(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const matchesHostGlob = (host: string, glob: string) => {
  const normalizedHost = host.trim().toLowerCase()
  const normalizedGlob = normalizeHostGlob(glob)
  if (!normalizedHost || !normalizedGlob) {
    return false
  }
  const pattern = `^${escapeRegExp(normalizedGlob).replace(/\\\*/g, '.*')}$`
  return new RegExp(pattern, 'i').test(normalizedHost)
}

export const matchesAnyHostGlob = (host: string, hostGlobs: string[]) => {
  return hostGlobs.some((glob) => matchesHostGlob(host, glob))
}

export const getEnabledUserStyleCss = (host: string, snapshot?: UserStylesSnapshot) => {
  const normalizedHost = host.trim().toLowerCase()
  const userStyles = snapshot || createDefaultUserStylesSnapshot()
  const builtinCss = builtinUserStyleDefinitions
    .filter((definition) => userStyles.builtins[definition.id]?.enabled !== false)
    .filter((definition) => matchesAnyHostGlob(normalizedHost, definition.hostGlobs))
    .map((definition) => definition.css.trim())
    .filter(Boolean)

  const customCss = (userStyles.customStyles || [])
    .filter((style) => style.enabled)
    .filter((style) => style.css.trim())
    .filter((style) => matchesAnyHostGlob(normalizedHost, style.hostGlobs))
    .map((style) => style.css.trim())
    .filter(Boolean)

  return [...builtinCss, ...customCss].join('\n\n')
}

const normalizeCustomUserStyle = (style: Partial<CustomUserStyle> | null | undefined, index: number): CustomUserStyle | null => {
  if (!style) {
    return null
  }

  const hostGlobs = sanitizeHostGlobs(style.hostGlobs)
  const css = typeof style.css === 'string' ? style.css.replace(/\s+$/, '') : ''
  if (!hostGlobs.length || !css.trim()) {
    return null
  }

  const name = typeof style.name === 'string' && style.name.trim() ? style.name.trim() : `Style ${index + 1}`

  return {
    id: typeof style.id === 'string' && style.id ? style.id : createId(6),
    name,
    enabled: typeof style.enabled === 'boolean' ? style.enabled : true,
    hostGlobs,
    css,
  }
}

export const normalizeUserStyles = (data?: Partial<UserStylesSnapshot>): UserStylesSnapshot => {
  const defaults = createDefaultUserStylesSnapshot()
  const builtins = createDefaultBuiltinUserStyles()

  for (const id of builtinUserStyleIds) {
    builtins[id] = {
      enabled: typeof data?.builtins?.[id]?.enabled === 'boolean' ? data.builtins[id].enabled : defaults.builtins[id].enabled,
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
