import { observable } from '@legendapp/state'

const TOAST_TIMEOUT_MS = 3000
const MAX_TOASTS = 3

export interface ToastItem {
  id: string
  message: string
}

// Feeds the in-app toast host. Android and the desktop shell each have a toast
// of their own (see lib/toast.android.ts, lib/toast.ts); this one backs iOS,
// which has no system toast.
export const toasts$ = observable<ToastItem[]>([])

const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function pushToast(message: string) {
  while (toasts$.length >= MAX_TOASTS) {
    dismissToast(toasts$[0].id.get())
  }

  const id = `${Date.now()}-${Math.random()}`
  toasts$.push({ id, message })
  dismissTimers.set(id, setTimeout(() => dismissToast(id), TOAST_TIMEOUT_MS))
}

export function dismissToast(id: string) {
  const timer = dismissTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    dismissTimers.delete(id)
  }
  toasts$.set(toasts$.get().filter((toast) => toast.id !== id))
}
