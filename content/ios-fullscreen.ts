export function installIOSFullscreen() {
  if (!window.NouTubeIOS || !document.fullscreenEnabled) return

  // YouTube prefers native video fullscreen on iOS even when the full
  // Fullscreen API is available. Use the shared container: its video and
  // mobile controls live in separate subtrees.
  window.addEventListener('click', (event) => {
    if (location.pathname !== '/watch' || !(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('.fullscreen-icon')
    const host = button?.closest<HTMLElement>('#player-container-id')
    if (!host?.querySelector('#movie_player video') || !host.requestFullscreen) return
    const active = document.fullscreenElement
    if (active && active !== host) return

    event.preventDefault()
    event.stopImmediatePropagation()
    if (active) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void host.requestFullscreen().catch(() => {})
    }
  }, true)
}
