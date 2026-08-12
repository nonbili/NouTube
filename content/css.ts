import { getEnabledUserStyleCss } from '../lib/user-styles'
import { noutubeSettingsEvent, noutubeUserStylesEvent } from './noutube'

const injectedStyleId = '_nou_injected_css'

const css = (strings: string[] | ArrayLike<string>, ...values: any[]) => String.raw({ raw: strings }, ...values)

const cssContentMobile = css`
  /*
   * Text zoom (webView textZoom) scales fonts but not the fixed pixel heights
   * YouTube hardcodes on its text containers, so zoomed titles/headlines get
   * clipped. Drop those height clamps so the boxes grow with the text;
   * -webkit-line-clamp still truncates long titles to the intended line count.
   */
  [class*='headline' i],
  [class*='title' i],
  [class*='subhead' i],
  [class*='channel-name' i] {
    height: auto !important;
    max-height: none !important;
  }

  /*
   * YouTube's control scrim fades to fully transparent at the bottom, but the
   * progress bar sits ~80% down, so the track (white at 35% alpha) disappears
   * over a bright frame. Darken the bottom and outline the bar to keep it and
   * the SponsorBlock segments readable.
   */
  #player-control-overlay .player-controls-background::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0) 35%);
    pointer-events: none;
  }

  #player-control-overlay .ytPlayerProgressBarHost {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6));
  }

  #_nou_fullscreen_title {
    display: none;
  }

  #player-container-id:fullscreen #_nou_fullscreen_title {
    display: block;
    position: absolute;
    top: 14px;
    left: 24px;
    right: 192px;
    z-index: 2;
    overflow: hidden;
    color: white;
    font-size: 18px;
    font-weight: 500;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  /*
   * Newer YouTube ships its own fullscreen title inside
   * player-fullscreen-top-controls, but keeps the whole host visibility:hidden
   * until the "More videos" panel opens. Unhide just the title (not the close
   * button next to it) and drop ours, otherwise both stack in the same corner.
   * Scoped to .fadein because the controls hide by flipping visibility, and a
   * title forced visible would stay burned over the video.
   */
  #player-container-id:fullscreen
    #player-control-overlay.fadein
    .ytwPlayerFullscreenTopControlsFullscreenControlsVideoTitle {
    visibility: visible;
  }

  #player-container-id:fullscreen
    #player-control-overlay:has(player-fullscreen-top-controls)
    #_nou_fullscreen_title {
    display: none;
  }

  /*
   * Lock button: only in fullscreen, only while playback is running (locking a
   * paused video is pointless), and only while the controls are showing, so it
   * never burns over the video. Left edge keeps it clear of the centered
   * play/seek buttons and the top-right control cluster. Hidden once locked,
   * where the unlock button takes over the same spot.
   */
  #_nou_lock_btn {
    display: none;
  }

  #player-container-id:fullscreen:has(#player-control-overlay.fadein):has(
      #movie_player.playing-mode,
      #movie_player.buffering-mode
    ):not(:has(#_nou_lock_overlay))
    > #_nou_lock_btn {
    display: flex;
    position: fixed;
    top: 50%;
    left: 16px;
    z-index: 2147483646;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    transform: translateY(-50%);
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: white;
  }

  #_nou_lock_overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  #_nou_lock_overlay ._nou_lock_unlock {
    position: absolute;
    top: 50%;
    left: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    transform: translateY(-50%);
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  #_nou_lock_overlay.reveal ._nou_lock_unlock {
    opacity: 1;
    pointer-events: auto;
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

  #_nou_livechat {
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
  #_nou_livechat.right {
    width: 36vw;
    height: 100%;
    top: 0;
    bottom: 0;
    right: 0;
    border-top: none;
    border-left: 1px solid #e5e5e5;
  }

  #_nou_livechat button {
    position: absolute;
    top: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
  }

  #_nou_livechat div {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  #_nou_livechat iframe {
    position: relative;
    flex: 1;
    border: none;
  }

  #_nou_livechat_btn {
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

  #_nou_audio_btn {
    display: flex;
    align-items: center;
    background: #34d399;
    padding: 0 4px;
    color: #44403c;
    border-radius: 4px;
    margin-left: 8px;
  }
  #_nou_audio_picker {
    position: absolute;
    top: 1rem;
    left: 1rem;
  }
  #_nou_audio_picker select {
    border: none;
    background: #a7f3d0;
    color: #44403c;
    padding: 2px;
  }

  ._nou_sb_segments {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  ._nou_sb_segment {
    position: absolute;
    top: 0;
    height: 100%;
    opacity: 0.85;
  }
`

export const getCoreCss = () => cssContent + (window.NouTubeI ? cssContentMobile : '')

export const getInjectedCss = (userStyles?: any) => {
  return [getCoreCss(), getEnabledUserStyleCss(document.location.host, userStyles)].filter(Boolean).join('\n\n')
}

export function injectCSS() {
  const style = document.querySelector<HTMLStyleElement>(`#${injectedStyleId}`) || document.createElement('style')

  const update = () => {
    const userStyles = window.NouTube?.getUserStyles?.()
    style.textContent = getInjectedCss(userStyles)
  }

  style.id = injectedStyleId
  style.type = 'text/css'
  update()
  ;(document.head || document.documentElement).appendChild(style)
  window.addEventListener(noutubeSettingsEvent, update)
  window.addEventListener(noutubeUserStylesEvent, update)
}

export function hideShorts() {
  const style = document.createElement('style')
  style.id = 'noutube-shorts'
  style.type = 'text/css'
  style.textContent = `
ytm-reel-shelf-renderer,
ytd-reel-shelf-renderer,
.ytGridShelfViewModelHost,
grid-shelf-view-model,
ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
ytm-shorts-lockup-view-model,
yt-lockup-view-model:has(a[href^='/shorts']),
ytd-video-renderer:has(a[href^='/shorts']),
ytm-video-with-context-renderer:has(a[href^='/shorts']),
ytd-guide-entry-renderer:has(a[href^='/shorts']),
ytd-mini-guide-entry-renderer:has(a[href^='/shorts']),
yt-tab-shape[tab-title='Shorts'],
ytm-pivot-bar-item-renderer:has(.pivot-shorts) {
  display: none !important;
}
`
  document.head.appendChild(style)
}

export function showShorts() {
  document.querySelector('style#noutube-shorts')?.remove()
}
