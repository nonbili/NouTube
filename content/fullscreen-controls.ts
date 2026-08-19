import { formatPlaybackQuality, playbackQualities } from '../lib/playback-quality'
import { formatPlaybackRate, playbackRates } from '../lib/playback-rate'
import { nouPolicy, parseJson } from './utils'

const btnId = '_nou_fs_btn'
const panelId = '_nou_fs_panel'
const scrimId = '_nou_fs_scrim'
const overlayId = '_nou_lock_overlay'
const unlockBtnClass = '_nou_lock_unlock'
const rowClass = '_nou_fs_row'
const chipClass = '_nou_fs_chip'
const sliderClass = '_nou_fs_slider'
const activeClass = 'active'
const revealClass = 'reveal'
const revealMs = 3000
const brightnessKey = 'nou:brightness'
const sideKey = 'nou:fsControlsSide'
const rightClass = 'right'

const iconTune = /* HTML */ `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <path
    d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
  ></path>
</svg>`

const iconLock = /* HTML */ `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <path
    d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7zm8 12H7v-8h10v8z"
  ></path>
</svg>`

const iconLockOpen = /* HTML */ `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <path
    d="M17 9H9V7a3 3 0 0 1 5.83-1l1.9-.62A5 5 0 0 0 7 7v2H5v12h14V9zm0 10H7v-8h10v8z"
  ></path>
</svg>`

const iconSwap = /* HTML */ `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
  <path d="M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"></path>
</svg>`

const iconVolume = /* HTML */ `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12z"></path>
</svg>`

const iconBrightness = /* HTML */ `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
  <path
    d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM11 1h2v3h-2V1zm0 19h2v3h-2v-3zM1 11h3v2H1v-2zm19 0h3v2h-3v-2zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1zM18.4 4.2l1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1z"
  ></path>
</svg>`

let revealTimer: ReturnType<typeof setTimeout> | undefined

// Which edge the button, the panel and the unlock button hug. Kept in
// localStorage rather than in app settings: it is only ever changed from the
// panel itself, so it never needs to cross the bridge.
const getSide = () => (localStorage.getItem(sideKey) === 'right' ? 'right' : 'left')

function applySide(element: HTMLElement | null) {
  element?.classList.toggle(rightClass, getSide() === 'right')
}

function toggleSide() {
  localStorage.setItem(sideKey, getSide() === 'right' ? 'left' : 'right')
  for (const id of [btnId, panelId, overlayId]) {
    applySide(document.getElementById(id))
  }
}

const getFullscreenElement = () =>
  (document.fullscreenElement || (document as any).webkitFullscreenElement) as HTMLElement | null

const getPlayer = (): any => document.getElementById('movie_player')

// Only the main frame is given the token, so the device-level bridge calls
// below are unreachable from ad iframes.
const bridgeToken = () => window.NouTubeToken || ''

const hasNativeBrightness = () => typeof window.NouTubeI?.setBrightness == 'function'

const hasNativeVolume = () => typeof window.NouTubeI?.setVolumeIndex == 'function'

const swallowedEvents = [
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'pointerdown',
  'pointermove',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
] as const

function revealUnlockButton(overlay: HTMLElement) {
  overlay.classList.add(revealClass)
  clearTimeout(revealTimer)
  revealTimer = setTimeout(() => overlay.classList.remove(revealClass), revealMs)
}

// The overlay and the panel scrim sit inside the player container, so events on
// them would otherwise still reach YouTube's own document-level and
// player-level handlers. Kill them before anything else sees them, letting only
// taps on our own controls through.
function blockEvent(event: Event) {
  const overlay = document.getElementById(overlayId)
  const panel = document.getElementById(panelId)
  if (!overlay && !panel) {
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest(`#${panelId}, .${unlockBtnClass}`)) {
    return
  }
  event.stopImmediatePropagation()
  if (event.cancelable) {
    event.preventDefault()
  }
  if (event.type === 'touchend' || event.type === 'click') {
    if (panel) {
      closePanel()
    } else if (overlay) {
      revealUnlockButton(overlay)
    }
  }
}

// blockEvent lets everything aimed at our own controls through untouched, but
// the panel and the unlock button sit inside the player container, so those
// events would keep bubbling into YouTube's tap-to-toggle and double-tap-seek
// handlers. Cut them off at our own element: listeners inside it have already
// run by then, and stopPropagation leaves default behaviour (slider drags,
// button activation) alone.
function isolateEvents(element: HTMLElement) {
  for (const type of swallowedEvents) {
    element.addEventListener(type, (event) => event.stopPropagation())
  }
}

function setEventBlocking(blocked: boolean) {
  for (const type of swallowedEvents) {
    if (blocked) {
      document.addEventListener(type, blockEvent, { capture: true, passive: false })
    } else {
      document.removeEventListener(type, blockEvent, { capture: true })
    }
  }
}

export function unlockScreen() {
  clearTimeout(revealTimer)
  revealTimer = undefined
  document.getElementById(overlayId)?.remove()
  if (!document.getElementById(panelId)) {
    setEventBlocking(false)
  }
}

function lockScreen() {
  // Only the fullscreen element's subtree is rendered while fullscreen, so the
  // overlay has to live inside it.
  const host = getFullscreenElement()
  if (!host || document.getElementById(overlayId)) {
    return
  }

  const overlay = document.createElement('div')
  overlay.id = overlayId
  applySide(overlay)
  overlay.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <button type="button" class="${unlockBtnClass}" aria-label="Unlock">${iconLockOpen}</button>
  `)
  const unlockBtn = overlay.querySelector<HTMLButtonElement>(`.${unlockBtnClass}`)!
  unlockBtn.addEventListener('click', () => unlockScreen())
  isolateEvents(unlockBtn)

  host.append(overlay)
  setEventBlocking(true)
  revealUnlockButton(overlay)
}

function getSavedBrightness() {
  const saved = Number(localStorage.getItem(brightnessKey))
  return Number.isFinite(saved) && saved > 0 && saved <= 100 ? saved : undefined
}

// Without a saved value the slider has to start where the screen actually is,
// not at full, so fall back to what the window reports.
function getCurrentBrightness() {
  const saved = getSavedBrightness()
  if (saved !== undefined) {
    return saved
  }
  const native = window.NouTubeI?.getBrightness?.(bridgeToken())
  return typeof native == 'number' && native > 0 ? Math.round(linearToGamma(native) * 100) : 100
}

// Android's brightness slider is gamma-encoded (the HLG curve in the platform's
// BrightnessUtils), but the window override takes the linear value, so 50% on
// the system slider is only ~0.07 linear. Convert both ways so our slider
// travels the same perceptual scale the system one does.
const gammaA = 0.17883277
const gammaB = 0.28466892
const gammaC = 0.55991073

function gammaToLinear(gamma: number) {
  const value = gamma <= 0.5 ? (gamma / 0.5) ** 2 : Math.exp((gamma - gammaC) / gammaA) + gammaB
  return Math.min(Math.max(value / 12, 0), 1)
}

function linearToGamma(linear: number) {
  const value = Math.min(Math.max(linear, 0), 1) * 12
  const gamma = value <= 1 ? 0.5 * Math.sqrt(value) : gammaA * Math.log(value - gammaB) + gammaC
  return Math.min(Math.max(gamma, 0), 1)
}

function applyBrightness(percent: number) {
  // The native side takes 0..1, with -1 meaning "hand control back to Android".
  window.NouTubeI?.setBrightness?.(bridgeToken(), percent >= 100 ? -1 : gammaToLinear(percent / 100))
}

function applySavedBrightness() {
  const saved = getSavedBrightness()
  if (saved !== undefined) {
    applyBrightness(saved)
  }
}

export function resetBrightness() {
  window.NouTubeI?.setBrightness?.(bridgeToken(), -1)
}

// Android WebView ignores writes to the media element's volume, so the slider
// drives the system media stream instead. That stream is stepped (typically 15
// notches), so the slider runs in step indices, not percent.
function getVolumeSteps() {
  const steps = window.NouTubeI?.getVolumeSteps?.(bridgeToken())
  return typeof steps == 'number' && steps > 0 ? steps : 0
}

function getVolumeIndex() {
  const index = window.NouTubeI?.getVolumeIndex?.(bridgeToken())
  return typeof index == 'number' && Number.isFinite(index) ? index : 0
}

function getAvailableQualities() {
  const levels = getPlayer()?.getAvailableQualityLevels?.()
  const available = Array.isArray(levels) ? levels : []
  // Keep our own descending order and drop the ones this video does not offer.
  return playbackQualities.filter((q) => q.value === 'auto' || available.includes(q.value)).map((q) => q.value)
}

// The player reports the level it actually picked, which is not the user's
// choice while on auto, so read the same saved setting player.ts applies.
function getCurrentQuality() {
  const settings = parseJson(localStorage.getItem('nou:settings'), {}) as { playbackQuality?: string }
  return typeof settings.playbackQuality == 'string' ? settings.playbackQuality : 'auto'
}

// The track is drawn by us (see css.ts), so the filled portion has to be fed in
// as a percentage.
function paintSlider(input: HTMLInputElement | null) {
  if (!input) {
    return
  }
  const min = Number(input.min)
  const max = Number(input.max)
  const ratio = max > min ? (Number(input.value) - min) / (max - min) : 0
  input.style.setProperty('--_nou_fill', `${Math.round(ratio * 100)}%`)
}

const chip = (group: string, value: string, label: string, active: boolean) => /* HTML */ `
  <button
    type="button"
    class="${chipClass}${active ? ` ${activeClass}` : ''}"
    data-group="${group}"
    data-value="${value}"
  >
    ${label}
  </button>
`

function renderPanelContent(panel: HTMLElement) {
  const rate = getPlayer()?.getPlaybackRate?.()
  const currentRate = typeof rate == 'number' && Number.isFinite(rate) ? rate : 1
  const currentQuality = getCurrentQuality()
  const brightness = getCurrentBrightness()
  const volumeSteps = getVolumeSteps()

  const speedChips = playbackRates
    .map((r) => chip('rate', String(r), formatPlaybackRate(r), r === currentRate))
    .join('')
  const qualityChips = getAvailableQualities()
    .map((q) => chip('quality', q, formatPlaybackQuality(q), q === currentQuality))
    .join('')

  panel.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <div class="${rowClass}">
      <button type="button" id="_nou_fs_lock">${iconLock}<span>Lock</span></button>
      <button type="button" id="_nou_fs_side" aria-label="Switch side">${iconSwap}</button>
    </div>
    <div class="${rowClass}">
      <span class="_nou_fs_label">Speed</span>
      <div class="_nou_fs_chips">${speedChips}</div>
    </div>
    <div class="${rowClass}">
      <span class="_nou_fs_label">Quality</span>
      <div class="_nou_fs_chips">${qualityChips}</div>
    </div>
    ${hasNativeVolume() && volumeSteps
      ? /* HTML */ `<div class="${rowClass}">
          ${iconVolume}
          <input
            class="${sliderClass}"
            id="_nou_fs_volume"
            type="range"
            min="0"
            max="${volumeSteps}"
            step="1"
            value="${getVolumeIndex()}"
          />
        </div>`
      : ''}
    ${hasNativeBrightness()
      ? /* HTML */ `<div class="${rowClass}">
          ${iconBrightness}
          <input
            class="${sliderClass}"
            id="_nou_fs_brightness"
            type="range"
            min="1"
            max="100"
            step="1"
            value="${brightness}"
          />
        </div>`
      : ''}
  `)

  panel.querySelector<HTMLButtonElement>('#_nou_fs_lock')!.addEventListener('click', () => {
    closePanel()
    lockScreen()
  })

  panel.querySelector<HTMLButtonElement>('#_nou_fs_side')!.addEventListener('click', () => toggleSide())

  panel.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const button = target.closest<HTMLElement>(`.${chipClass}`)
    if (!button) {
      return
    }
    const { group, value } = button.dataset
    if (group === 'rate') {
      getPlayer()?.setPlaybackRate?.(Number(value))
    } else if (group === 'quality') {
      const player = getPlayer()
      if (player?.setPlaybackQualityRange) {
        player.setPlaybackQualityRange(value, value)
      } else {
        player?.setPlaybackQuality?.(value)
      }
    } else {
      return
    }
    for (const sibling of button.parentElement!.querySelectorAll(`.${chipClass}`)) {
      sibling.classList.toggle(activeClass, sibling === button)
    }
  })

  const volumeInput = panel.querySelector<HTMLInputElement>('#_nou_fs_volume')
  volumeInput?.addEventListener('input', () => {
    window.NouTubeI?.setVolumeIndex?.(bridgeToken(), Number(volumeInput.value))
    paintSlider(volumeInput)
  })
  paintSlider(volumeInput)

  const brightnessInput = panel.querySelector<HTMLInputElement>('#_nou_fs_brightness')
  brightnessInput?.addEventListener('input', () => {
    const percent = Number(brightnessInput.value)
    localStorage.setItem(brightnessKey, String(percent))
    applyBrightness(percent)
    paintSlider(brightnessInput)
  })
  paintSlider(brightnessInput)
}

function closePanel() {
  document.getElementById(panelId)?.remove()
  document.getElementById(scrimId)?.remove()
  if (!document.getElementById(overlayId)) {
    setEventBlocking(false)
  }
}

function openPanel() {
  const host = getFullscreenElement()
  if (!host || document.getElementById(panelId)) {
    return
  }

  const scrim = document.createElement('div')
  scrim.id = scrimId

  const panel = document.createElement('div')
  panel.id = panelId
  applySide(panel)
  renderPanelContent(panel)
  isolateEvents(panel)

  host.append(scrim, panel)
  setEventBlocking(true)
}

function renderControlsButton() {
  // Sits next to the control overlay rather than inside it: YouTube's own
  // control layers hit-test above anything appended into .player-controls-content,
  // so a button in there is visible but never receives the tap.
  const host = getFullscreenElement()
  if (!host || host.querySelector(`:scope > #${btnId}`)) {
    return
  }

  const btn = document.createElement('button')
  btn.id = btnId
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Player controls')
  btn.innerHTML = nouPolicy.createHTML(iconTune)
  applySide(btn)
  btn.onclick = () => openPanel()
  isolateEvents(btn)
  host.append(btn)
}

export function installFullscreenControls() {
  if (!window.isAndroid) {
    return
  }

  // YouTube rebuilds the control overlay during the fullscreen transition and
  // on video changes, so re-add the button whenever the player subtree changes.
  const observer = new MutationObserver(() => renderControlsButton())

  const onFullscreenChange = () => {
    const host = getFullscreenElement()
    if (host) {
      renderControlsButton()
      applySavedBrightness()
      observer.observe(host, { childList: true, subtree: true })
    } else {
      observer.disconnect()
      closePanel()
      unlockScreen()
      // The brightness override belongs to the fullscreen player, not to
      // browsing, so hand control back to Android on the way out.
      resetBrightness()
    }
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
}
