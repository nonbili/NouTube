import { nouPolicy } from './utils'

const lockBtnId = '_nou_lock_btn'
const overlayId = '_nou_lock_overlay'
const unlockBtnClass = '_nou_lock_unlock'
const revealClass = 'reveal'
const revealMs = 3000

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

let revealTimer: ReturnType<typeof setTimeout> | undefined

const getFullscreenElement = () =>
  (document.fullscreenElement || (document as any).webkitFullscreenElement) as HTMLElement | null

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

// The overlay sits inside the player container (see lockScreen), so events on it
// would otherwise still reach YouTube's own document-level and player-level
// handlers. Kill them before anything else sees them, letting only taps on the
// unlock button through.
function blockEvent(event: Event) {
  const overlay = document.getElementById(overlayId)
  if (!overlay) {
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest(`.${unlockBtnClass}`)) {
    return
  }
  event.stopImmediatePropagation()
  if (event.cancelable) {
    event.preventDefault()
  }
  if (event.type === 'touchend' || event.type === 'click') {
    revealUnlockButton(overlay)
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
  setEventBlocking(false)
  document.getElementById(overlayId)?.remove()
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
  overlay.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <button type="button" class="${unlockBtnClass}" aria-label="Unlock">${iconLockOpen}</button>
  `)
  overlay.querySelector<HTMLButtonElement>(`.${unlockBtnClass}`)!.addEventListener('click', (event) => {
    event.stopPropagation()
    unlockScreen()
  })

  host.append(overlay)
  setEventBlocking(true)
  revealUnlockButton(overlay)
}

function renderLockButton() {
  // Sits next to the control overlay rather than inside it: YouTube's own
  // control layers hit-test above anything appended into .player-controls-content,
  // so a button in there is visible but never receives the tap.
  const host = getFullscreenElement()
  if (!host || host.querySelector(`:scope > #${lockBtnId}`)) {
    return
  }

  const btn = document.createElement('button')
  btn.id = lockBtnId
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Lock screen')
  btn.innerHTML = nouPolicy.createHTML(iconLock)
  btn.onclick = (event) => {
    event.stopPropagation()
    lockScreen()
  }
  host.append(btn)
}

export function installScreenLock() {
  if (!window.isAndroid) {
    return
  }

  // YouTube rebuilds the control overlay during the fullscreen transition and
  // on video changes, so re-add the button whenever the player subtree changes.
  const observer = new MutationObserver(() => renderLockButton())

  const onFullscreenChange = () => {
    const host = getFullscreenElement()
    if (host) {
      renderLockButton()
      observer.observe(host, { childList: true, subtree: true })
    } else {
      observer.disconnect()
      unlockScreen()
    }
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
}
