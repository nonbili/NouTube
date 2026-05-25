export const BLOCKLIST_SCHEMA_VERSION = 1

export type BlocklistKind = 'channel' | 'keyword'

export interface BlocklistEntry {
  id: string
  value: string
  enabled: boolean
  createdAt: number
}

export interface BlocklistSnapshot {
  schemaVersion: number
  channels: BlocklistEntry[]
  keywords: BlocklistEntry[]
}

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const createId = (size = 8) => {
  let value = ''
  for (let index = 0; index < size; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return value
}

export const createDefaultBlocklistSnapshot = (): BlocklistSnapshot => ({
  schemaVersion: BLOCKLIST_SCHEMA_VERSION,
  channels: [],
  keywords: [],
})

export const normalizeBlocklistValue = (value: string) => {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.|m\.)?youtube\.com\//i, '')
    .replace(/^\/+/, '')
    .replace(/^(c|channel|user)\//i, '')
    .replace(/^\/+/, '')
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

export const blocklistChannelMatches = (text: string | undefined, entries: BlocklistEntry[]) => {
  if (!text) {
    return false
  }

  const normalized = normalizeBlocklistValue(text)
  if (!normalized) {
    return false
  }

  return getEnabledBlocklistValues(entries).some((value) => normalized === value)
}

export const blocklistChannelsMatch = (texts: Array<string | undefined>, entries: BlocklistEntry[]) => {
  return texts.some((text) => blocklistChannelMatches(text, entries))
}


export const createBlocklistEntry = (value: string, existing?: Partial<BlocklistEntry>): BlocklistEntry | null => {
  const normalized = normalizeBlocklistValue(value)
  if (!normalized) {
    return null
  }

  return {
    id: typeof existing?.id === 'string' && existing.id ? existing.id : createId(),
    value: normalized,
    enabled: typeof existing?.enabled === 'boolean' ? existing.enabled : true,
    createdAt: typeof existing?.createdAt === 'number' ? existing.createdAt : Date.now(),
  }
}

const normalizeEntries = (entries: Array<Partial<BlocklistEntry> | string> | undefined) => {
  const seen = new Set<string>()
  const normalized: BlocklistEntry[] = []

  for (const item of entries || []) {
    const entry = typeof item === 'string' ? createBlocklistEntry(item) : createBlocklistEntry(item.value || '', item)
    if (!entry || seen.has(entry.value)) {
      continue
    }
    seen.add(entry.value)
    normalized.push(entry)
  }

  return normalized
}

export const normalizeBlocklist = (data?: Partial<BlocklistSnapshot>): BlocklistSnapshot => ({
  schemaVersion: BLOCKLIST_SCHEMA_VERSION,
  channels: normalizeEntries(data?.channels as Array<Partial<BlocklistEntry> | string> | undefined),
  keywords: normalizeEntries(data?.keywords as Array<Partial<BlocklistEntry> | string> | undefined),
})

export const addBlocklistEntry = (
  entries: BlocklistEntry[],
  value: string,
): { entries: BlocklistEntry[]; id: string } => {
  const entry = createBlocklistEntry(value)
  if (!entry) {
    return { entries, id: '' }
  }

  const existing = entries.find((item) => item.value === entry.value)
  if (existing) {
    return { entries, id: existing.id }
  }

  return { entries: entries.concat(entry), id: entry.id }
}

export const getEnabledBlocklistValues = (entries: BlocklistEntry[]) =>
  entries.filter((entry) => entry.enabled).map((entry) => entry.value)

export const blocklistTextMatches = (text: string | undefined, entries: BlocklistEntry[]) => {
  if (!text) {
    return false
  }

  const normalized = normalizeBlocklistValue(text)
  if (!normalized) {
    return false
  }

  return getEnabledBlocklistValues(entries).some((value) => normalized.includes(value))
}

export const blocklistTextsMatch = (texts: Array<string | undefined>, entries: BlocklistEntry[]) => {
  return texts.some((text) => blocklistTextMatches(text, entries))
}
