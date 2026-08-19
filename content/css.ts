import { getEnabledUserStyleCss } from '../lib/user-styles'
import { getCaptionCss } from './captions'
import { noutubeSettingsEvent, noutubeUserStylesEvent } from './noutube'

const injectedStyleId = '_nou_injected_css'

const css = (strings: string[] | ArrayLike<string>, ...values: any[]) => String.raw({ raw: strings }, ...values)

const cssContentMobile = css`
  /*
   * Text zoom (webView textZoom) scales fonts but not the fixed pixel heights
   * YouTube hardcodes on its text containers, so zoomed titles/headlines get
   * clipped. Drop those height clamps so the boxes grow with the text;
   * -webkit-line-clamp still truncates long titles to the intended line count.
   *
   * The player is excluded: its own class list carries title-related flags
   * (ytp-hide-fullscreen-title), and forcing height:auto on #movie_player
   * collapses it to 0, clipping the video away.
   */
  :is(
      [class*='headline' i],
      [class*='title' i],
      [class*='subhead' i],
      [class*='channel-name' i]
    ):not(#movie_player, #movie_player *) {
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

  /*
   * YouTube Music mobile: when minimized to the bottom player bar,
   * YouTube Music's collapse selector typo leaves ytmusic-app-layout fixed and
   * leaves full player page backgrounds and overlays active over browsing content.
   */
  ytmusic-app-layout[player-ui-state='PLAYER_BAR_ONLY'] {
    position: static !important;
    animation: none !important;
    transform: none !important;
  }

  ytmusic-player-page[player-ui-state='PLAYER_BAR_ONLY'] {
    visibility: hidden !important;
    background: transparent !important;
    pointer-events: none !important;
  }

  ytmusic-player-page[player-ui-state='PLAYER_BAR_ONLY'] ytmusic-player {
    visibility: visible !important;
    pointer-events: auto !important;
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
    /*
     * The title box spans the full width, under the top-right control cluster.
     * YouTube gets away with that because the whole host is hidden; once we
     * make the title visible it starts hit-testing and swallows taps on the
     * captions and settings buttons, so it has to stay inert like ours.
     */
    pointer-events: none;
    /*
     * Its flex parent only reserves room for the close button (40px) next to
     * the host's 12px padding, so the title still runs under the controls.
     * Back both out of the 192px inset ours uses to land on the same edge.
     */
    margin-right: 140px;
  }

  #player-container-id:fullscreen
    #player-control-overlay:has(player-fullscreen-top-controls)
    #_nou_fullscreen_title {
    display: none;
  }

  /*
   * Fullscreen controls button: only in fullscreen, and only while the controls
   * are showing, so it never burns over the video. Left edge keeps it clear of
   * the centered play/seek buttons and the top-right control cluster. Hidden
   * once the panel or the lock overlay takes over.
   *
   * --_nou_cutout_left is published by the native view (NouTubeView.kt): the
   * fullscreen window draws under the display cutout, and in landscape the
   * camera sits on a side edge at the same height as the button.
   */
  #_nou_fs_btn {
    display: none;
  }

  #player-container-id:fullscreen:has(#player-control-overlay.fadein):not(
      :has(#_nou_lock_overlay, #_nou_fs_panel)
    )
    > #_nou_fs_btn {
    display: flex;
    position: fixed;
    top: 50%;
    left: calc(16px + var(--_nou_cutout_left, 0px));
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

  /* Same chain as above so it outweighs the left-edge rule. */
  #player-container-id:fullscreen:has(#player-control-overlay.fadein):not(
      :has(#_nou_lock_overlay, #_nou_fs_panel)
    )
    > #_nou_fs_btn.right {
    left: auto;
    right: calc(16px + var(--_nou_cutout_right, 0px));
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
    left: calc(16px + var(--_nou_cutout_left, 0px));
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

  #_nou_lock_overlay.right ._nou_lock_unlock {
    left: auto;
    right: calc(16px + var(--_nou_cutout_right, 0px));
  }

  #_nou_lock_overlay.reveal ._nou_lock_unlock {
    opacity: 1;
    pointer-events: auto;
  }
`

// Shared by the Android and desktop fullscreen control panels.
const cssFullscreenPanel = css`
  /*
   * The scrim only exists to give taps outside the panel something to land on;
   * the panel's own event blocking still runs, this just keeps the hit area from
   * falling through to YouTube's own layers visually.
   */
  #_nou_fs_scrim {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
  }

  #_nou_fs_panel {
    position: fixed;
    top: 50%;
    left: calc(16px + var(--_nou_cutout_left, 0px));
    z-index: 2147483647;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: min(420px, calc(100vw - 32px - var(--_nou_cutout_left, 0px) - var(--_nou_cutout_right, 0px)));
    max-height: 80vh;
    overflow-y: auto;
    padding: 14px 16px;
    transform: translateY(-50%);
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.82);
    color: white;
    font-size: 13px;
    touch-action: pan-x pan-y;
    -webkit-user-select: none;
    user-select: none;
  }

  #_nou_fs_panel.right {
    left: auto;
    right: calc(16px + var(--_nou_cutout_right, 0px));
  }

  #_nou_fs_panel ._nou_fs_row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  #_nou_fs_panel ._nou_fs_label {
    flex: none;
    width: 52px;
    color: rgba(255, 255, 255, 0.7);
  }

  #_nou_fs_panel ._nou_fs_chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  #_nou_fs_panel ._nou_fs_chips::-webkit-scrollbar {
    display: none;
  }

  #_nou_fs_panel ._nou_fs_chip {
    flex: none;
    padding: 5px 10px;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    font-size: 13px;
    line-height: 1;
  }

  #_nou_fs_panel ._nou_fs_chip.active {
    background: #4f46e5;
  }

  #_nou_fs_panel ._nou_fs_value {
    flex: none;
    width: 40px;
    color: rgba(255, 255, 255, 0.7);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  #_nou_fs_panel #_nou_fs_lock {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    font-size: 14px;
  }

  #_nou_fs_panel #_nou_fs_side {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  /*
   * The WebView's native range widget centres its thumb on its own track
   * metrics, which do not match the 4px track we want, so draw both parts
   * ourselves. --_nou_fill is written by the panel on every input so the filled
   * portion still tracks the value without accent-color.
   */
  #_nou_fs_panel ._nou_fs_slider {
    flex: 1;
    height: 16px;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    box-shadow: none;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
  }

  #_nou_fs_panel ._nou_fs_slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      #4f46e5 var(--_nou_fill, 0%),
      rgba(255, 255, 255, 0.3) var(--_nou_fill, 0%)
    );
  }

  #_nou_fs_panel ._nou_fs_slider::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border: none;
    border-radius: 50%;
    background: white;
    -webkit-appearance: none;
    appearance: none;
  }
`

const cssContentDesktop = css`
  /*
   * Fullscreen controls button, desktop shell. The Android rule keys off
   * #player-container-id and the mobile control overlay, neither of which the
   * desktop site has; here the button is a direct child of whatever element
   * YouTube put into fullscreen, and fullscreen-controls.ts toggles .hidden to
   * follow the player's own autohide.
   */
  #_nou_fs_btn {
    display: none;
  }

  :fullscreen > #_nou_fs_btn {
    position: fixed;
    top: 50%;
    left: 16px;
    z-index: 2147483646;
    display: flex;
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
    cursor: pointer;
    opacity: 1;
    transition: opacity 0.2s;
  }

  :fullscreen > #_nou_fs_btn:hover {
    background: rgba(0, 0, 0, 0.75);
  }

  :fullscreen > #_nou_fs_btn.right {
    left: auto;
    right: 16px;
  }

  /* Faded rather than display:none so it can still be hovered back into view. */
  :fullscreen > #_nou_fs_btn.hidden {
    opacity: 0;
  }

  /*
   * A mouse cannot swipe a chip strip, and shift+wheel is not something to make
   * the only way to reach the last few chips, so wrap them instead of scrolling
   * on desktop.
   */
  #_nou_fs_panel ._nou_fs_chips {
    flex-wrap: wrap;
    overflow-x: visible;
  }

  /* Once the chips wrap, the label belongs beside the first row of them, not
     centred against the whole block. 23px is a chip's height: 13px of text plus
     its 5px padding. */
  #_nou_fs_panel ._nou_fs_row:has(._nou_fs_chips) {
    align-items: flex-start;
  }

  #_nou_fs_panel ._nou_fs_row:has(._nou_fs_chips) ._nou_fs_label {
    line-height: 23px;
  }

  #_nou_fs_panel ._nou_fs_chip,
  #_nou_fs_panel #_nou_fs_side {
    cursor: pointer;
  }

  #_nou_fs_panel ._nou_fs_chip:hover:not(.active) {
    background: rgba(255, 255, 255, 0.24);
  }

  #_nou_fs_panel #_nou_fs_side:hover {
    background: rgba(255, 255, 255, 0.24);
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

  /* Ads are normally dropped from the feed data, but if one still renders, hide
   * its grid cell too, otherwise the hidden ad leaves a blank tile behind. */
  ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
  ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer),
  ytd-rich-section-renderer:has(ytd-ad-slot-renderer),
  ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
  ytd-item-section-renderer:has(ytd-ad-slot-renderer),
  ytm-rich-item-renderer:has(ad-slot-renderer),
  ytm-item-section-renderer:has(ad-slot-renderer),
  ytd-rich-item-renderer:has(ad-slot-renderer),
  ytd-rich-item-renderer:has(.ytwFeedAdMetadataViewModelHostMetadata) {
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

export const getCoreCss = () => {
  const isDesktop = Boolean(window.electron)
  return (
    cssContent +
    (window.NouTubeI ? cssContentMobile : '') +
    (isDesktop ? cssContentDesktop : '') +
    (window.NouTubeI || isDesktop ? cssFullscreenPanel : '')
  )
}

export const getInjectedCss = (userStyles?: any) => {
  return [getCoreCss(), getCaptionCss(), getEnabledUserStyleCss(document.location.host, userStyles)]
    .filter(Boolean)
    .join('\n\n')
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
