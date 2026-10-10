export type ReplayMessage = {
  id: string
  authorExternalChannelId?: string
  authorName?: any
  authorPhoto?: any
  message?: any
  headerSubtext?: any
  purchaseAmountText?: any
  timestampText?: any
  sticker?: any
}

const messageRenderers = [
  'liveChatTextMessageRenderer',
  'liveChatPaidMessageRenderer',
  'liveChatPaidStickerRenderer',
  'liveChatMembershipItemRenderer',
  'liveChatViewerEngagementMessageRenderer',
  'liveChatSponsorshipsGiftRedemptionAnnouncementRenderer',
]

export function chatReplayImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const url = value.startsWith('//') ? `https:${value}` : value
  return url.startsWith('https://') ? url : undefined
}

export function chatReplayPollDelay(actions: any[] = []) {
  return actions.some((action) => action.replayChatItemAction?.actions?.length) ? 1000 : 5000
}

// YouTube supplies a video-time threshold for prefetching, not a delay before
// the next request. Allow at least two wall-clock seconds at the current rate.
export function shouldPrefetchChatReplay(time: number, bufferedUntil: number, rate: number, thresholdMsec: number) {
  return bufferedUntil - time <= Math.max(thresholdMsec / 1000, rate * 2)
}

// A response can contain messages ahead of playback. Keep them buffered so
// pausing the video also pauses chat, and discard the buffer after a seek.
export class ChatReplayBuffer {
  private pending: { time: number; actions: any[] }[] = []
  readonly messages = new Map<string, ReplayMessage>()
  bufferedUntil = 0

  clear() {
    this.pending = []
    this.messages.clear()
    this.bufferedUntil = 0
  }

  append(actions: any[] = []) {
    for (const action of actions) {
      const replay = action.replayChatItemAction
      if (replay) {
        const time = Number(replay.videoOffsetTimeMsec) / 1000
        if (!Number.isFinite(time)) continue
        this.bufferedUntil = Math.max(this.bufferedUntil, time)
        this.pending.push({ time, actions: replay.actions || [] })
      }
    }
    this.pending.sort((a, b) => a.time - b.time)
  }

  advance(time: number) {
    let changed = false
    while (this.pending.length && this.pending[0].time <= time) {
      for (const action of this.pending.shift()!.actions) {
        const item = action.addChatItemAction?.item || action.replaceChatItemAction?.replacementItem
        if (item) {
          const message = messageRenderers.map((renderer) => item[renderer]).find((value) => value?.id) as ReplayMessage | undefined
          const replacedId = action.replaceChatItemAction?.targetItemId
          if (message) {
            if (replacedId && this.messages.has(replacedId) && replacedId !== message.id) {
              // Map.set preserves order only when the key stays the same.
              const entries = Array.from(this.messages, ([id, value]): [string, ReplayMessage] =>
                id === replacedId ? [message.id, message] : [id, value],
              )
              this.messages.clear()
              for (const [id, value] of entries) this.messages.set(id, value)
            } else {
              this.messages.set(message.id, message)
            }
            changed = true
          } else if (replacedId) {
            // YouTube can replace a removed message with a placeholder.
            changed = this.messages.delete(replacedId) || changed
          }
        }
        const removedId = action.markChatItemAsDeletedAction?.targetItemId || action.removeChatItemAction?.targetItemId
        if (removedId) changed = this.messages.delete(removedId) || changed
        const authorId = action.markChatItemsByAuthorAsDeletedAction?.externalChannelId || action.removeChatItemByAuthorAction?.externalChannelId
        if (authorId) {
          for (const [id, message] of this.messages) {
            if (message.authorExternalChannelId === authorId) changed = this.messages.delete(id) || changed
          }
        }
      }
      while (this.messages.size > 100) this.messages.delete(this.messages.keys().next().value!)
    }
    return changed
  }
}

export function getChatReplay(response: any): string | undefined {
  const chat = response?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer
  const continuation = chat?.continuations?.[0]?.reloadContinuationData?.continuation
  return chat?.isReplay && typeof continuation === 'string' ? continuation : undefined
}
