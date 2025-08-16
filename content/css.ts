const css = (strings: string[] | ArrayLike<string>, ...values: any[]) => String.raw({ raw: strings }, ...values)

const cssContentMobile = css`
  * {
    user-select: none;
  }
`

const cssContent = css`
  ytd-page-top-ad-layout-renderer,
  ytd-in-feed-ad-layout-renderer,
  ad-slot-renderer,
  yt-mealbar-promo-renderer,
  ytm-promoted-sparkles-web-renderer,
  .ytd-player-legacy-desktop-watch-ads-renderer,
  a.app-install-link,
  a.yt-spec-button-shape-next {
    display: none !important;
  }

  #_inks_livechat {
    width: 100%;
    height: 50vh;
    position: fixed;
    bottom: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #e5e5e5;
    background: white;
    z-index: 10;
  }
  #_inks_livechat.right {
    width: 36vw;
    height: 100%;
    top: 0;
    bottom: 0;
    right: 0;
    border-top: none;
    border-left: 1px solid #e5e5e5;
  }

  #_inks_livechat button {
    position: absolute;
    top: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
  }

  #_inks_livechat div {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  #_inks_livechat iframe {
    position: relative;
    flex: 1;
    border: none;
  }

  #_inks_livechat_btn {
    padding: 0.75rem 1rem;
    background: #e1002d;
    color: white;
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    border-radius: 18px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 16px;
  }

  .quick-actions-wrapper.enable-rtl-mirroring {
    display: none !important;
  }

  #_inks_audio_btn {
    display: flex;
    align-items: center;
    background: #34d399;
    padding: 0 4px;
    color: #44403c;
    border-radius: 4px;
    margin-left: 8px;
  }
  #_inks_audio_picker {
    position: absolute;
    top: 1rem;
    left: 1rem;
  }
  #_inks_audio_picker select {
    border: none;
    background: #a7f3d0;
    color: #44403c;
    padding: 2px;
  }
`

export function injectCSS() {
  const style = document.createElement('style')
  style.type = 'text/css'
  style.textContent = cssContent
  if (window.NouTubeI) {
    style.textContent += cssContentMobile
  }
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
