const css = `
* {
  user-select: none;
}
ad-slot-renderer,
ytmusic-mealbar-promo-renderer,
yt-mealbar-promo-renderer,
ytm-promoted-sparkles-web-renderer,
.ytd-player-legacy-desktop-watch-ads-renderer,
a.yt-spec-button-shape-next {
  display: none !important;
}
`

export function injectCSS() {
  const style = document.createElement('style')
  style.type = 'text/css'
  style.textContent = css
  document.head.appendChild(style)
}

export function hideShorts() {
  const style = document.createElement('style')
  style.id = 'noutube-shorts'
  style.type = 'text/css'
  style.textContent = `
ytm-reel-shelf-renderer,
ytd-rich-section-renderer,
.ytGridShelfViewModelHost {
  display: none !important;
}
`
  document.head.appendChild(style)
}

export function showShorts() {
  document.querySelector('style#noutube-shorts')?.remove()
}
