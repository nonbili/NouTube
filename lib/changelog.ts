export type ReleaseEntry = {
  tag: string
  url: string
  updatedAt: string
  items: string[]
}

const entryPattern = /<entry>([\s\S]*?)<\/entry>/g

function decodeEntities(input: string) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  }

function stripTags(input: string) {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractTag(input: string, tag: string) {
  const match = input.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`))
  return match?.[1]?.trim() || ''
}

function extractLinkHref(input: string) {
  const match = input.match(/<link\b[^>]*href="([^"]+)"[^>]*\/?>/)
  return match?.[1] || ''
}

function extractListItems(content: string) {
  const decoded = decodeEntities(content)
  const items = [...decoded.matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map((match) => stripTags(decodeEntities(match[1] || '')))
    .filter(Boolean)

  return items
}

export function parseReleaseFeed(xml: string) {
  return [...xml.matchAll(entryPattern)]
    .map((match) => {
      const entry = match[1]
      const tag = extractTag(entry, 'title')
      const updatedAt = extractTag(entry, 'updated')
      const url = extractLinkHref(entry)
      const items = extractListItems(extractTag(entry, 'content'))

      if (!tag || !updatedAt || !url) {
        return null
      }

      return {
        tag,
        url,
        updatedAt,
        items,
      } satisfies ReleaseEntry
    })
    .filter((entry): entry is ReleaseEntry => Boolean(entry))
}
