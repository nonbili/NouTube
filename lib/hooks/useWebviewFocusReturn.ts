import { useEffect } from 'react'
import { cancelWebviewRefocus, onPointerDown, onPointerUp, openModal, scheduleWebviewRefocus } from '../webview-focus'

/* Mount in every modal; pass `active` for modals that stay mounted while closed. */
export function useModalFocusReturn(active = true) {
  useEffect(() => (active ? openModal() : undefined), [active])
}

/* Hand focus back to the webview whenever it lands in the app shell (see lib/webview-focus.ts). */
export function useWebviewFocusReturn() {
  useEffect(() => {
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerUp, true)
    document.addEventListener('focusin', scheduleWebviewRefocus)
    return () => {
      cancelWebviewRefocus()
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
      document.removeEventListener('focusin', scheduleWebviewRefocus)
    }
  }, [])
}
