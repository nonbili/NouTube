import { nouPolicy } from './utils'

const iconCross = `<svg height="24" viewBox="0 0 24 24" width="24"><path d="m12.71 12 8.15 8.15-.71.71L12 12.71l-8.15 8.15-.71-.71L11.29 12 3.15 3.85l.71-.71L12 11.29l8.15-8.15.71.71L12.71 12z"></path></svg>`

const iconLiveChat = `<svg height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M16 3v11H7.59L5 16.59V3h11m1-1H4v17l4-4h9V2zM8 18h8l4 4V6h-1v13.59L16.41 17H8v1z"></path></svg>`

function showLiveChat(videoId: string) {
  let container = document.querySelector('div#_inks_livechat')
  const existed = !!container
  if (!container) {
    container = document.createElement('div')
    container.id = '_inks_livechat'
  }
  container.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <div>Loading...</div>
    <iframe src="https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${document.location.hostname}"></iframe>
    <button>${iconCross}</button>
  `)
  if (!existed) {
    container.querySelector('button')!.onclick = () => container.remove()
    document.body.append(container)
  }
  if (window.innerWidth > 1000 && window.innerWidth > window.innerHeight) {
    container.classList.add('right')
  } else {
    container.classList.remove('right')
  }
}

export function hideLiveChat() {
  document.querySelector('div#_inks_livechat')?.remove()
  document.querySelector('button#_inks_livechat_btn')?.remove()
}

export function showLiveChatButton(videoId: string) {
  let btn = document.querySelector('button#_inks_livechat_btn') as HTMLButtonElement
  const existed = !!btn

  if (!btn) {
    btn = document.createElement('button')
    btn.id = '_inks_livechat_btn'
    btn.innerHTML = nouPolicy.createHTML(`${iconLiveChat} Live chat`)
    btn.onclick = () => showLiveChat(videoId)
  }

  if (!existed) {
    document.body.append(btn)
  }
}
