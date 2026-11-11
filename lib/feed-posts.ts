// Community posts are not in a channel's RSS feed, so they are read from the
// data its Posts tab is rendered from. No sign-in is needed for public posts.

export interface FeedPost {
  id: string
  url: string
  text: string
  thumbnail?: string
  publishedAt: Date
}

const POST_TEXT_LIMIT = 280

// `hl=en` pins the relative timestamps ("5 hours ago") to a language we parse.
export function getChannelPostsUrl(channelId: string) {
  return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/posts?hl=en`
}

export function getPostUrl(postId: string) {
  return `https://www.youtube.com/post/${postId}`
}

export function isPostUrl(url: string) {
  try {
    const { host, pathname } = new URL(url)
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) && pathname.startsWith('/post/')
  } catch {
    return false
  }
}

// The desktop page inlines the data as an object literal; the mobile page, which
// is what an app's default user agent is redirected to, as an escaped JS string.
export function extractInitialData(html: string): unknown {
  // Sliced by index: a lazy regex over a page this size exhausts Hermes's regex stack.
  const marker = 'var ytInitialData'
  const start = html.indexOf(marker)
  if (start === -1) {
    return undefined
  }
  const end = html.indexOf('</script>', start)
  if (end === -1) {
    return undefined
  }
  const literal = html
    .slice(start + marker.length, end)
    .replace(/^\s*=\s*/, '')
    .replace(/;\s*$/, '')

  if (literal.startsWith('{')) {
    return parseJson(literal)
  }

  if (literal.startsWith("'") && literal.endsWith("'")) {
    // One pass, so an escaped backslash is never read as the start of another escape.
    return parseJson(
      literal.slice(1, -1).replace(/\\(x[0-9a-fA-F]{2}|[\s\S])/g, (_match, escape: string) =>
        escape.length === 3 ? String.fromCharCode(parseInt(escape.slice(1), 16)) : escape,
      ),
    )
  }

  return undefined
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const UNIT_MS: Record<string, number> = {
  second: 1000,
  minute: 60 * 1000,
  hour: 3600 * 1000,
  day: 24 * 3600 * 1000,
  week: 7 * 24 * 3600 * 1000,
  month: 30 * 24 * 3600 * 1000,
  year: 365 * 24 * 3600 * 1000,
}

// YouTube only publishes a relative time for posts, so the date is an estimate
// that is exact to the unit shown: the hour for today's posts, the day after.
export function parseRelativeTime(text: string, now: Date): Date | undefined {
  if (/\bjust now\b/i.test(text)) {
    return new Date(now)
  }
  const match = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i)
  if (!match) {
    return undefined
  }
  return new Date(now.valueOf() - Number(match[1]) * UNIT_MS[match[2].toLowerCase()])
}

function textOf(node: any): string {
  if (!node) return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs)) return node.runs.map((run: any) => run?.text ?? '').join('')
  return ''
}

function findThumbnail(node: any, depth = 0): string | undefined {
  if (!node || typeof node !== 'object' || depth > 8) return undefined
  if (Array.isArray(node.thumbnails) && node.thumbnails.length) {
    const candidates = node.thumbnails.filter((x: any) => typeof x?.url === 'string')
    const picked = candidates.find((x: any) => (x.width ?? 0) >= 288) ?? candidates[candidates.length - 1]
    if (picked) {
      return picked.url.startsWith('//') ? `https:${picked.url}` : picked.url
    }
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = findThumbnail(value, depth + 1)
    if (found) return found
  }
  return undefined
}

function collectPostRenderers(node: any, results: any[] = []): any[] {
  if (!node || typeof node !== 'object') return results
  if (Array.isArray(node)) {
    node.forEach((item) => collectPostRenderers(item, results))
    return results
  }
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'backstagePostRenderer' || key === 'sharedPostRenderer') && value && typeof value === 'object') {
      // Not descended into: a shared post embeds the original, which belongs to
      // another channel and must not be listed as one of this channel's posts.
      results.push(value)
    } else {
      collectPostRenderers(value, results)
    }
  }
  return results
}

export function extractCommunityPosts(html: string, now = new Date()): FeedPost[] {
  const data = extractInitialData(html)
  if (!data) {
    return []
  }

  const posts: FeedPost[] = []
  const seen = new Set<string>()
  for (const renderer of collectPostRenderers(data)) {
    const id = renderer.postId
    if (typeof id !== 'string' || !id || seen.has(id)) continue

    const publishedAt = parseRelativeTime(textOf(renderer.publishedTimeText), now)
    // A post we cannot date would land at an arbitrary place in the feed.
    if (!publishedAt) continue
    seen.add(id)

    const text = textOf(renderer.contentText ?? renderer.content)
      .replace(/\s+/g, ' ')
      .trim()
    posts.push({
      id,
      url: getPostUrl(id),
      text: text.length > POST_TEXT_LIMIT ? `${text.slice(0, POST_TEXT_LIMIT).trimEnd()}…` : text,
      thumbnail: findThumbnail(renderer.backstageAttachment ?? renderer.originalPost),
      // Posts sharing a relative time ("2 days ago") keep the page's order.
      publishedAt: new Date(publishedAt.valueOf() - posts.length),
    })
  }
  return posts
}
