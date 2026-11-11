import { describe, expect, it } from 'bun:test'
import { extractCommunityPosts, extractInitialData, isPostUrl, parseRelativeTime } from './feed-posts'

const now = new Date('2026-11-11T12:00:00Z')

const post = (postId: string, time: string, extra: object = {}) => ({
  backstagePostThreadRenderer: {
    post: {
      backstagePostRenderer: {
        postId,
        contentText: { runs: [{ text: `hello\n` }, { text: `from ${postId}` }] },
        publishedTimeText: { runs: [{ text: time }] },
        ...extra,
      },
    },
  },
})

const desktopPage = (data: object) => `<script nonce="x">var ytInitialData = ${JSON.stringify(data)};</script>`

// What m.youtube.com serves: every quote, brace and backslash hex- or backslash-escaped.
const mobilePage = (data: object) => {
  const escaped = JSON.stringify(data)
    .replace(/\\/g, '\\\\')
    .replace(/["{}=&']/g, (ch) => `\\x${ch.charCodeAt(0).toString(16)}`)
    .replace(/\//g, '\\/')
  return `<script nonce="x">var ytInitialData = '${escaped}';</script>`
}

describe('parseRelativeTime', () => {
  it('reads the units YouTube uses', () => {
    expect(parseRelativeTime('5 hours ago', now)?.toISOString()).toBe('2026-11-11T07:00:00.000Z')
    expect(parseRelativeTime('1 day ago', now)?.toISOString()).toBe('2026-11-10T12:00:00.000Z')
    expect(parseRelativeTime('2 weeks ago (edited)', now)?.toISOString()).toBe('2026-10-28T12:00:00.000Z')
  })

  it('rejects text it cannot date', () => {
    expect(parseRelativeTime('5 時間前', now)).toBeUndefined()
    expect(parseRelativeTime('', now)).toBeUndefined()
  })
})

describe('extractInitialData', () => {
  const data = { a: 'it\'s "quoted" \\ and /slashed/', b: [{ c: 1 }] }

  it('reads the desktop object literal', () => {
    expect(extractInitialData(desktopPage(data))).toEqual(data)
  })

  it('reads the mobile escaped string', () => {
    expect(extractInitialData(mobilePage(data))).toEqual(data)
  })

  it('returns undefined for a page without data', () => {
    expect(extractInitialData('<html>consent</html>')).toBeUndefined()
  })
})

describe('extractCommunityPosts', () => {
  it('lists posts in page order with text, url and image', () => {
    const data = {
      contents: [
        post('A', '2 days ago'),
        post('B', '2 days ago', {
          backstageAttachment: {
            backstageImageRenderer: {
              image: { thumbnails: [{ url: '//img/small', width: 100 }, { url: '//img/big', width: 400 }] },
            },
          },
        }),
      ],
    }

    for (const html of [desktopPage(data), mobilePage(data)]) {
      const posts = extractCommunityPosts(html, now)
      expect(posts.map((x) => x.id)).toEqual(['A', 'B'])
      expect(posts[0].text).toBe('hello from A')
      expect(posts[0].url).toBe('https://www.youtube.com/post/A')
      expect(posts[0].thumbnail).toBeUndefined()
      expect(posts[1].thumbnail).toBe('https://img/big')
      expect(posts[0].publishedAt.valueOf()).toBeGreaterThan(posts[1].publishedAt.valueOf())
    }
  })

  it('skips duplicates, undated posts and the original inside a shared post', () => {
    const data = {
      contents: [
        post('A', '1 hour ago'),
        post('A', '1 hour ago'),
        post('B', 'sometime'),
        {
          sharedPostRenderer: {
            postId: 'C',
            content: { runs: [{ text: 'look at this' }] },
            publishedTimeText: { runs: [{ text: '3 days ago' }] },
            originalPost: { backstagePostRenderer: { postId: 'D', publishedTimeText: { runs: [{ text: '4 days ago' }] } } },
          },
        },
      ],
    }

    const posts = extractCommunityPosts(desktopPage(data), now)
    expect(posts.map((x) => x.id)).toEqual(['A', 'C'])
    expect(posts[1].text).toBe('look at this')
  })

  it('truncates long text', () => {
    const data = { contents: [post('A', '1 hour ago', { contentText: { runs: [{ text: 'x'.repeat(500) }] } })] }
    expect(extractCommunityPosts(desktopPage(data), now)[0].text).toHaveLength(281)
  })
})

describe('isPostUrl', () => {
  it('matches post urls only', () => {
    expect(isPostUrl('https://www.youtube.com/post/Ugkx')).toBe(true)
    expect(isPostUrl('https://www.youtube.com/watch?v=abc')).toBe(false)
    expect(isPostUrl('not a url')).toBe(false)
  })
})
