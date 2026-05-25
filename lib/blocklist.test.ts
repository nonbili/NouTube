import { describe, expect, it } from 'bun:test'
import {
  addBlocklistEntry,
  blocklistTextMatches,
  createBlocklistEntry,
  normalizeBlocklist,
  normalizeBlocklistValue,
} from './blocklist'

describe('blocklist', () => {
  it('normalizes values for matching', () => {
    expect(normalizeBlocklistValue(' @Channel1 ')).toBe('channel1')
    expect(normalizeBlocklistValue('https://www.youtube.com/@Channel1')).toBe('channel1')
  })

  it('filters invalid entries and removes duplicates', () => {
    const snapshot = normalizeBlocklist({
      channels: [
        { id: 'a', value: 'Channel1', enabled: true, createdAt: 1 },
        { id: 'b', value: ' channel1 ', enabled: true, createdAt: 2 },
        { id: 'c', value: '   ', enabled: true, createdAt: 3 },
      ],
      keywords: ['Spoiler', 'spoiler'],
    } as any)

    expect(snapshot.channels).toHaveLength(1)
    expect(snapshot.channels[0].id).toBe('a')
    expect(snapshot.keywords).toHaveLength(1)
    expect(snapshot.keywords[0].value).toBe('spoiler')
  })

  it('adds entries without duplicating normalized values', () => {
    const first = createBlocklistEntry('channel1')!
    const result = addBlocklistEntry([first], '@Channel1')

    expect(result.entries).toHaveLength(1)
    expect(result.id).toBe(first.id)
  })

  it('matches enabled entries case-insensitively', () => {
    const snapshot = normalizeBlocklist({
      keywords: [
        { id: 'a', value: 'Final Boss', enabled: true, createdAt: 1 },
        { id: 'b', value: 'Drama', enabled: false, createdAt: 2 },
      ],
    })

    expect(blocklistTextMatches('My FINAL BOSS guide', snapshot.keywords)).toBe(true)
    expect(blocklistTextMatches('Daily drama update', snapshot.keywords)).toBe(false)
  })
})
