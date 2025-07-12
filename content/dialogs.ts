let handled = false

export function handleDialogs() {
  if (handled) {
    return
  }
  const target = document.querySelector('tp-yt-paper-dialog')
  if (!target) {
    return
  }
  const observer = new MutationObserver((mutations) => {
    const dismissButton = target.querySelector('ytmusic-mealbar-promo-renderer .dismiss-button')
    if (dismissButton) {
      ;(dismissButton as HTMLElement).click()
    }
  })
  observer.observe(target, {
    attributes: true,
  })
  handled = true
}
