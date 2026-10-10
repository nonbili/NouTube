import { ChatReplayBuffer, chatReplayImageUrl, chatReplayPollDelay, getChatReplay, shouldPrefetchChatReplay, type ReplayMessage } from '../lib/live-chat-replay'
import { getYouTubeAuthorization } from '../lib/youtube-auth'

async function request(path: string, data: object, signal: AbortSignal) {
  const ytcfg = (window as any).ytcfg
  const context = ytcfg?.get('INNERTUBE_CONTEXT')
  if (!context?.client) throw new Error('YouTube context is not ready')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Secure SID cookies can outlive sign-out; do not authenticate a logged-out page.
  const authorization = ytcfg.get('LOGGED_IN') === false
    ? undefined
    : await getYouTubeAuthorization(location.origin, document.cookie)
  if (authorization) {
    headers.Authorization = authorization
    headers['X-Goog-AuthUser'] = String(ytcfg.get('SESSION_INDEX') ?? 0)
    headers['X-Origin'] = location.origin
    const pageId = ytcfg.get('DELEGATED_SESSION_ID')
    if (pageId) headers['X-Goog-PageId'] = pageId
  }
  if (context.client.visitorData) headers['X-Goog-Visitor-Id'] = context.client.visitorData
  const response = await fetch(`${location.origin}/youtubei/v1/${path}?prettyPrint=false`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      context: { ...context, client: {
        ...context.client,
        clientName: 'WEB',
        platform: 'DESKTOP',
        clientFormFactor: 'UNKNOWN_FORM_FACTOR',
      } },
      ...data,
    }),
  })
  if (!response.ok) throw new Error(`Chat request failed: ${response.status}`)
  return response.json()
}

export async function findChatReplay(videoId: string, signal: AbortSignal) {
  // MWEB omits the conversation bar. Ask for WEB data on the current origin so
  // the WebView's cookies still apply without switching the watch page to desktop.
  return getChatReplay(await request('next', { videoId }, signal))
}

function appendText(element: HTMLElement, text: any) {
  if (text?.simpleText) element.append(document.createTextNode(text.simpleText))
  for (const run of text?.runs || []) {
    if (run.text) element.append(document.createTextNode(run.text))
    const emoji = run.emoji
    if (emoji) {
      const image = document.createElement('img')
      image.className = '_nou_replay_emoji'
      image.alt = emoji.image?.accessibility?.accessibilityData?.label || emoji.shortcuts?.[0] || emoji.emojiId || ''
      const src = chatReplayImageUrl(emoji.image?.thumbnails?.[0]?.url)
      if (src) {
        image.src = src
        element.append(image)
      } else {
        element.append(document.createTextNode(image.alt))
      }
    }
  }
}

function renderMessage(message: ReplayMessage) {
  const row = document.createElement('article')
  row.className = '_nou_replay_message'
  const photo = chatReplayImageUrl(message.authorPhoto?.thumbnails?.[0]?.url)
  if (photo) {
    const image = document.createElement('img')
    image.className = '_nou_replay_avatar'
    image.src = photo
    image.alt = ''
    row.append(image)
  }
  const body = document.createElement('span')
  const timestamp = document.createElement('small')
  appendText(timestamp, message.timestampText)
  body.append(timestamp)
  const author = document.createElement('strong')
  appendText(author, message.authorName)
  body.append(author)
  appendText(body, message.purchaseAmountText)
  appendText(body, message.headerSubtext)
  appendText(body, message.message)
  const sticker = chatReplayImageUrl(message.sticker?.thumbnails?.at(-1)?.url)
  if (sticker) {
    const image = document.createElement('img')
    image.className = '_nou_replay_sticker'
    image.src = sticker
    image.alt = message.sticker?.accessibility?.accessibilityData?.label || 'Paid sticker'
    body.append(image)
  }
  row.append(body)
  return row
}

export function mountChatReplay(container: Element, videoId: string, initialContinuation: string) {
  const panel = document.createElement('section')
  panel.className = '_nou_replay_panel'
  const header = document.createElement('header')
  const title = document.createElement('span')
  title.textContent = 'Chat replay'
  header.append(title)
  const close = container.querySelector('._nou_livechat_close')
  if (close) header.append(close)
  const status = document.createElement('p')
  status.textContent = 'Loading...'
  const retry = document.createElement('button')
  retry.className = '_nou_replay_retry'
  retry.textContent = 'Retry'
  retry.hidden = true
  const list = document.createElement('section')
  list.className = '_nou_replay_messages'
  list.setAttribute('aria-label', 'Chat replay messages')
  panel.append(header, status, retry, list)
  container.prepend(panel)

  const buffer = new ChatReplayBuffer()
  let continuation = initialContinuation
  let seekContinuation = initialContinuation
  let controller = new AbortController()
  let revision = 0
  let stopped = false
  let loading = false
  let failed = false
  let lastTime: number | undefined
  let prefetchThresholdMsec = 5000
  let nextRequestAt = 0
  let hasLoaded = false
  const rows = new Map<string, { message: ReplayMessage; element: HTMLElement }>()

  function redraw() {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40
    const listTop = list.getBoundingClientRect().top
    // Hold a surviving visible row in place when older rows are evicted.
    const anchor = atBottom ? undefined : Array.from(rows.entries()).find(([id, row]) =>
      buffer.messages.has(id) && row.element.getBoundingClientRect().bottom > listTop,
    )
    const anchorTop = anchor?.[1].element.getBoundingClientRect().top
    for (const [id, row] of rows) {
      if (!buffer.messages.has(id)) {
        row.element.remove()
        rows.delete(id)
      }
    }
    let previous: HTMLElement | undefined
    for (const [id, message] of buffer.messages) {
      let row = rows.get(id)
      if (!row || row.message !== message) {
        const element = renderMessage(message)
        row?.element.replaceWith(element)
        row = { message, element }
        rows.set(id, row)
      }
      const expected = previous ? previous.nextElementSibling : list.firstElementChild
      if (row.element !== expected) list.insertBefore(row.element, expected)
      previous = row.element
    }
    status.hidden = !failed && buffer.messages.size > 0
    if (atBottom) list.scrollTop = list.scrollHeight
    else if (anchor && anchorTop !== undefined) {
      const element = rows.get(anchor[0])?.element
      if (element) list.scrollTop += element.getBoundingClientRect().top - anchorTop
    }
  }

  function reset() {
    controller.abort()
    controller = new AbortController()
    revision++
    loading = false
    failed = false
    nextRequestAt = 0
    hasLoaded = false
    continuation = seekContinuation
    buffer.clear()
    list.replaceChildren()
    rows.clear()
    status.hidden = false
    status.textContent = 'Loading...'
    retry.hidden = true
  }

  async function tick() {
    const player = document.querySelector('#movie_player') as any
    if (stopped || player?.getPlayerResponse?.()?.videoDetails?.videoId !== videoId) return
    const time = player.getCurrentTime?.()
    if (typeof time !== 'number' || !Number.isFinite(time)) return
    const rate = (document.querySelector('#movie_player video') as HTMLVideoElement)?.playbackRate || 1
    if (lastTime !== undefined && (time < lastTime - 1 || time > lastTime + Math.max(5, rate * 2))) reset()
    lastTime = time
    if (buffer.advance(time)) redraw()
    if (loading || failed || !continuation || performance.now() < nextRequestAt) return
    if (hasLoaded && (player.getPlayerState?.() !== 1 ||
      !shouldPrefetchChatReplay(time, buffer.bufferedUntil, rate, prefetchThresholdMsec))) return
    loading = true
    const requestRevision = revision
    try {
      const response = await request('live_chat/get_live_chat_replay', {
        continuation,
        currentPlayerState: { playerOffsetMs: String(Math.floor(time * 1000)) },
      }, controller.signal)
      if (stopped || requestRevision !== revision) return
      const chat = response?.continuationContents?.liveChatContinuation
      if (!chat) throw new Error('Chat replay is unavailable')
      buffer.append(chat.actions)
      const next = chat.continuations?.find((item: any) => item.liveChatReplayContinuationData)?.liveChatReplayContinuationData
      const seek = chat.continuations?.find((item: any) => item.playerSeekContinuationData)?.playerSeekContinuationData
      continuation = next?.continuation || ''
      seekContinuation = seek?.continuation || initialContinuation
      prefetchThresholdMsec = Number(next?.timeUntilLastMessageMsec ?? 5000)
      // Quiet stretches back off in wall-clock time, independently of playback speed.
      nextRequestAt = performance.now() + chatReplayPollDelay(chat.actions)
      hasLoaded = true
      if (buffer.advance(player.getCurrentTime())) redraw()
      status.hidden = buffer.messages.size > 0
      status.textContent = 'No messages at this point in the video.'
    } catch {
      if (stopped || requestRevision !== revision) return
      failed = true
      status.hidden = false
      status.textContent = 'Unable to load chat replay.'
      retry.hidden = false
    } finally {
      if (requestRevision === revision) loading = false
    }
  }

  retry.onclick = () => {
    reset()
    void tick()
  }
  const video = document.querySelector('#movie_player video') as HTMLVideoElement | null
  const onSeek = () => {
    lastTime = undefined
    reset()
    void tick()
  }
  video?.addEventListener('seeked', onSeek)
  const timer = setInterval(() => { void tick() }, 500)
  void tick()
  return () => {
    stopped = true
    controller.abort()
    clearInterval(timer)
    video?.removeEventListener('seeked', onSeek)
  }
}
