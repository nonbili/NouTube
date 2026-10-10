import { nouPolicy } from './utils'
import { findChatReplay, mountChatReplay } from './livechat-replay'

let stopReplay: (() => void) | undefined
let replayLookup: AbortController | undefined

function closeLiveChat() {
  stopReplay?.()
  stopReplay = undefined
  document.querySelector('div#_nou_livechat')?.remove()
}

const iconCross = `<svg height="24" viewBox="0 0 24 24" width="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"></path></svg>`

const iconLiveChat = `<svg height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M16 3v11H7.59L5 16.59V3h11m1-1H4v17l4-4h9V2zM8 18h8l4 4V6h-1v13.59L16.41 17H8v1z"></path></svg>`

function showLiveChat(videoId: string, replayContinuation?: string) {
  closeLiveChat()
  const container = document.createElement('div')
  container.id = '_nou_livechat'
  container.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <div id="_nou_livechat_loading">Loading...</div>
    <button class="_nou_livechat_close" aria-label="Close chat" title="Close chat">${iconCross}</button>
  `)
  container.querySelector('button')!.onclick = closeLiveChat
  document.body.append(container)
  if (replayContinuation) {
    container.querySelector('#_nou_livechat_loading')?.remove()
    stopReplay = mountChatReplay(container, videoId, replayContinuation)
  } else {
    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}&embed_domain=${document.location.hostname}`
    container.querySelector('#_nou_livechat_loading')!.after(iframe)
  }
  if (window.innerWidth > 1000 && window.innerWidth > window.innerHeight) {
    container.classList.add('right')
  } else {
    container.classList.remove('right')
  }
}

export function hideLiveChat() {
  replayLookup?.abort()
  replayLookup = undefined
  closeLiveChat()
  document.querySelector('button#_nou_livechat_btn')?.remove()
}

export function showLiveChatButton(videoId: string, replayContinuation?: string) {
  let btn = document.querySelector('button#_nou_livechat_btn') as HTMLButtonElement
  const existed = !!btn

  if (!btn) {
    btn = document.createElement('button')
    btn.id = '_nou_livechat_btn'
  }
  btn.innerHTML = nouPolicy.createHTML(`${iconLiveChat} ${replayContinuation ? 'Chat replay' : 'Live chat'}`)
  btn.onclick = () => showLiveChat(videoId, replayContinuation)

  if (!existed) {
    document.body.append(btn)
  }
}

export async function showLiveChatReplayButton(videoId: string) {
  replayLookup?.abort()
  const controller = new AbortController()
  replayLookup = controller
  try {
    const continuation = await findChatReplay(videoId, controller.signal)
    if (continuation && !controller.signal.aborted) showLiveChatButton(videoId, continuation)
  } catch {
    // No replay button when YouTube has disabled chat or the lookup fails.
  }
}
