const fullscreenClass = '_nou_ios_fullscreen'
const fullscreenCss = `
  html:has(.${fullscreenClass}), body:has(.${fullscreenClass}) { overflow: hidden !important; }
  .${fullscreenClass} {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    background: black;
    z-index: 2147483647 !important;
  }
  .${fullscreenClass} :is(#player, #movie_player, .html5-video-container) {
    box-sizing: border-box;
    width: 100% !important;
    height: 100dvh !important;
    min-height: 0 !important;
    padding: 0 !important;
  }
  .${fullscreenClass} video.html5-main-video {
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
  }
  .${fullscreenClass} #player-control-overlay:has(ytm-fullscreen-related-videos-entry-point-view-model button)
    .fullscreen-icon {
    translate: 0 -48px;
  }
`

export function installIOSFullscreen() {
  const present = window.NouTubeI?.setYouTubeFullscreen
  if (!present || document.fullscreenEnabled || !['m.youtube.com', 'www.youtube.com'].includes(location.hostname)) return

  const onWatchPage = () => location.pathname === '/watch'
  let active: { target: Element; player: HTMLElement; style: HTMLStyleElement } | undefined
  const observer = new MutationObserver(checkPlayer)

  function fullscreenChanged(target: EventTarget) {
    target.dispatchEvent(new Event('fullscreenchange', { bubbles: true }))
    target.dispatchEvent(new Event('webkitfullscreenchange', { bubbles: true }))
  }

  function exit() {
    if (!active) return Promise.resolve()
    const { target, player, style } = active
    active = undefined
    observer.disconnect()
    player.classList.remove(fullscreenClass)
    style.remove()
    present?.(false)
    fullscreenChanged(target.isConnected ? target : document)
    return Promise.resolve()
  }

  function checkPlayer() {
    if (active && (!onWatchPage() || !active.target.isConnected || !active.player.isConnected)) void exit()
  }

  function request(this: Element) {
    // The mobile player asks to fullscreen the video itself. Expand its
    // container so the existing control overlay and touch handlers stay live.
    const player = this.closest<HTMLElement>('#player-container-id') ?? this.closest<HTMLElement>('#movie_player')
    const video = player?.querySelector<HTMLVideoElement>('video.html5-main-video')
    if (!onWatchPage() || !this.isConnected || !player || !video) {
      return Promise.reject(new TypeError('The YouTube watch player is unavailable'))
    }
    if (active) return Promise.resolve()
    const style = document.createElement('style')
    style.textContent = fullscreenCss
    document.head.append(style)
    player.classList.add(fullscreenClass)
    active = { target: this, player, style }
    observer.observe(document.body, { childList: true, subtree: true })
    const explicit = Date.now() - (window.NouTubeFsIntent ?? 0) < 500
    present?.(true, explicit && video.videoHeight > 0 && video.videoWidth > video.videoHeight)
    fullscreenChanged(this)
    return Promise.resolve()
  }

  // WebKit disables element fullscreen on YouTube on small screens. Expose
  // the subset its watch player uses so it chooses HTML controls over AVKit.
  const legacyDocument = document as Document & { webkitExitFullscreen?: () => void }
  const legacyElement = Element.prototype as Element & { webkitRequestFullscreen?: () => void }
  Object.defineProperties(document, {
    fullscreenEnabled: { get: onWatchPage },
    webkitFullscreenEnabled: { get: onWatchPage },
    fullscreenElement: { get: () => active?.target ?? null },
    webkitFullscreenElement: { get: () => active?.target ?? null },
  })
  document.exitFullscreen = exit
  legacyDocument.webkitExitFullscreen = () => { void exit() }
  Element.prototype.requestFullscreen = request
  legacyElement.webkitRequestFullscreen = function () { void request.call(this).catch(() => {}) }

  // A rebuilt mobile toolbar can still label the icon as an entry button.
  // Make that same control exit even if YouTube no longer recognizes its state.
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element && event.target.closest('.fullscreen-icon, .ytp-fullscreen-button')
    if (active && button && active.player.contains(button)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      void exit()
    }
  }, true)
  document.addEventListener('keydown', (event) => {
    if (active && event.key === 'Escape' && !event.defaultPrevented) void exit()
  })
  window.addEventListener('popstate', checkPlayer)
  window.addEventListener('yt-navigate-finish', checkPlayer)
  window.addEventListener('pagehide', exit)
}
