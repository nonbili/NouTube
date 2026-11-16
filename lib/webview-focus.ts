import { ui$ } from '@/states/ui'
import { isEditableTarget } from './paste-url'

/*
 * Desktop keeps keyboard focus in the active webview so player shortcuts
 * (space, arrows...) always work:
 * - while any modal is open, focus is left alone;
 * - otherwise, whenever focus lands in the app shell (a clicked button, a
 *   menu trigger after the menu closes, nothing after a modal closes), it is
 *   handed back to the webview.
 * Open menus, text inputs and other webviews (the embed player) keep focus.
 */

// Modals on desktop are plain views, not dialogs, so they register here.
let openModals = 0
let pointerPressed = false
let timer: ReturnType<typeof setTimeout> | undefined

const isWebview = (el: Element | null | undefined) => el?.tagName === 'WEBVIEW'

const shouldKeepFocus = (el: Element | null) =>
  openModals > 0 || Boolean(document.querySelector('[role="menu"]')) || isEditableTarget(el) || isWebview(el)

export function scheduleWebviewRefocus() {
  clearTimeout(timer)
  // Let click handlers run, modals mount and menus close (Radix returns focus
  // to the trigger asynchronously) before deciding.
  timer = setTimeout(() => {
    if (pointerPressed || shouldKeepFocus(document.activeElement)) {
      return
    }
    ui$.webview.get()?.focus?.()
  }, 0)
}

/* Register an open modal; returns the function to call when it closes. */
export function openModal() {
  openModals++
  // A modal opened by a shortcut leaves focus inside the webview, where the
  // app never sees Escape or Tab. Pull focus back into the app shell.
  const active = document.activeElement as HTMLElement | null
  if (isWebview(active)) {
    active?.blur?.()
  }
  let closed = false
  return () => {
    if (closed) {
      return
    }
    closed = true
    openModals--
    scheduleWebviewRefocus()
  }
}

export function onPointerDown() {
  pointerPressed = true
}

// Refocusing mid-press could cancel the press, so wait for pointerup.
export function onPointerUp() {
  pointerPressed = false
  scheduleWebviewRefocus()
}

export function cancelWebviewRefocus() {
  clearTimeout(timer)
}
