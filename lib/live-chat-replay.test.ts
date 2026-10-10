import { describe, expect, test } from 'bun:test'
import { ChatReplayBuffer, chatReplayImageUrl, chatReplayPollDelay, getChatReplay, shouldPrefetchChatReplay } from './live-chat-replay'

const add = (id: string, authorExternalChannelId = 'author') => ({
  addChatItemAction: { item: { liveChatTextMessageRenderer: { id, authorExternalChannelId, message: { simpleText: id } } } },
})
const replay = (seconds: number, ...actions: any[]) => ({ replayChatItemAction: { videoOffsetTimeMsec: String(seconds * 1000), actions } })

describe('chat replay', () => {
  test('normalises protocol-relative images while rejecting insecure and executable URLs', () => {
    expect(chatReplayImageUrl('//lh3.googleusercontent.com/sticker.png')).toBe('https://lh3.googleusercontent.com/sticker.png')
    expect(chatReplayImageUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png')
    for (const url of [undefined, 42, 'http://example.com/image.png', 'javascript:alert(1)', 'data:image/svg+xml,x', '/image.png']) {
      expect(chatReplayImageUrl(url)).toBeUndefined()
    }
  })

  test('backs off for empty replay responses, including timestamp-only actions', () => {
    expect(chatReplayPollDelay()).toBe(5000)
    expect(chatReplayPollDelay([])).toBe(5000)
    expect(chatReplayPollDelay([replay(20)])).toBe(5000)
    expect(chatReplayPollDelay([replay(20), replay(21, add('message'))])).toBe(1000)
  })

  test('includes gift redemption announcements with their author and message', () => {
    const buffer = new ChatReplayBuffer()
    const gift = {
      id: 'gift', authorName: { simpleText: 'Recipient' }, message: { simpleText: 'Received a gift membership' },
    }
    buffer.append([replay(0, { addChatItemAction: { item: { liveChatSponsorshipsGiftRedemptionAnnouncementRenderer: gift } } })])
    buffer.advance(0)
    expect(buffer.messages.get('gift')).toEqual(gift)
  })

  test('only offers replay when YouTube supplies a replay continuation', () => {
    const response = (isReplay: boolean, continuation?: string) => ({
      contents: { twoColumnWatchNextResults: { conversationBar: { liveChatRenderer: {
        isReplay, continuations: [{ reloadContinuationData: { continuation } }],
      } } } },
    })
    expect(getChatReplay(response(true, 'replay-token'))).toBe('replay-token')
    expect(getChatReplay(response(false, 'live-token'))).toBeUndefined()
    expect(getChatReplay(response(true))).toBeUndefined()
    expect(getChatReplay({})).toBeUndefined()
  })

  test('buffers future messages and leaves paused chat unchanged', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([replay(20, add('future')), replay(10, add('current'))])
    expect(buffer.advance(10)).toBe(true)
    expect([...buffer.messages.keys()]).toEqual(['current'])
    expect(buffer.advance(10)).toBe(false)
    expect(buffer.advance(20)).toBe(true)
    expect([...buffer.messages.keys()]).toEqual(['current', 'future'])
  })

  test('seeking clears both displayed and buffered messages', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([replay(10, add('old')), replay(20, add('old-future'))])
    buffer.advance(10)
    buffer.clear()
    buffer.append([replay(5, add('seek-result'))])
    buffer.advance(30)
    expect([...buffer.messages.keys()]).toEqual(['seek-result'])
  })

  test('applies moderation and replacement actions at their playback times', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([
      replay(0, add('one'), add('two', 'other')),
      replay(1, { replaceChatItemAction: { targetItemId: 'two', replacementItem: { liveChatTextMessageRenderer: { id: 'replacement' } } } }),
      replay(2, { markChatItemsByAuthorAsDeletedAction: { externalChannelId: 'author' } }),
      replay(3, { removeChatItemAction: { targetItemId: 'replacement' } }),
    ])
    buffer.advance(1)
    expect([...buffer.messages.keys()]).toEqual(['one', 'replacement'])
    buffer.advance(2)
    expect([...buffer.messages.keys()]).toEqual(['replacement'])
    buffer.advance(3)
    expect(buffer.messages.size).toBe(0)
  })

  test('limits long-running chat and deduplicates repeated responses', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append(Array.from({ length: 110 }, (_, i) => replay(0, add(String(i)))))
    buffer.advance(0)
    expect(buffer.messages.size).toBe(100)
    expect(buffer.messages.has('0')).toBe(false)
    buffer.append([replay(0, add('109'))])
    buffer.advance(0)
    expect(buffer.messages.size).toBe(100)
  })

  test('prefetches before the buffered video time runs out at 1x, 2x and 4x', () => {
    expect(shouldPrefetchChatReplay(100, 110, 1, 5000)).toBe(false)
    expect(shouldPrefetchChatReplay(105, 110, 1, 5000)).toBe(true)
    expect(shouldPrefetchChatReplay(105, 110, 2, 5000)).toBe(true)
    expect(shouldPrefetchChatReplay(102, 110, 4, 5000)).toBe(true)
    expect(shouldPrefetchChatReplay(100, 110, 4, 5000)).toBe(false)
    expect(shouldPrefetchChatReplay(108, 110, 1, 0)).toBe(true)
  })

  test('tracks the end of a response even when it contains no visible messages', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([replay(20, add('one')), replay(25)])
    buffer.advance(20)
    expect(buffer.bufferedUntil).toBe(25)
    buffer.clear()
    expect(buffer.bufferedUntil).toBe(0)
  })

  test('keeps a replaced message between its original neighbours', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([replay(0, add('one'), add('two'), add('three'))])
    buffer.advance(0)
    buffer.append([replay(1, { replaceChatItemAction: {
      targetItemId: 'two', replacementItem: { liveChatTextMessageRenderer: { id: 'replacement', message: { simpleText: 'edited' } } },
    } })])
    buffer.advance(1)
    expect([...buffer.messages.keys()]).toEqual(['one', 'replacement', 'three'])
    buffer.append([replay(2, { replaceChatItemAction: {
      targetItemId: 'replacement', replacementItem: { liveChatTextMessageRenderer: { id: 'replacement', message: { simpleText: 'edited again' } } },
    } })])
    buffer.advance(2)
    expect([...buffer.messages.keys()]).toEqual(['one', 'replacement', 'three'])
    expect(buffer.messages.get('replacement')?.message.simpleText).toBe('edited again')
  })

  test('skips placeholder renderers and preserves paid sticker images', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([replay(0,
      { addChatItemAction: { item: { liveChatPlaceholderItemRenderer: { id: 'placeholder' } } } },
      { addChatItemAction: { item: { liveChatPaidStickerRenderer: { id: 'sticker', sticker: {
        thumbnails: [{ url: 'https://example.com/sticker.png' }],
      } } } } },
    )])
    buffer.advance(0)
    expect([...buffer.messages.keys()]).toEqual(['sticker'])
    expect(buffer.messages.get('sticker')?.sticker.thumbnails[0].url).toBe('https://example.com/sticker.png')
  })

  test('removes messages that YouTube replaces with a placeholder', () => {
    const buffer = new ChatReplayBuffer()
    buffer.append([replay(0, add('one'), add('two'))])
    buffer.advance(0)
    buffer.append([replay(1, { replaceChatItemAction: {
      targetItemId: 'one', replacementItem: { liveChatPlaceholderItemRenderer: { id: 'placeholder' } },
    } })])
    buffer.advance(1)
    expect([...buffer.messages.keys()]).toEqual(['two'])
  })
})
