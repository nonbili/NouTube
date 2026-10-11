import { observable } from '@legendapp/state'

const TOAST_TIMEOUT_MS = 3000
const MAX_TOASTS = 3

export interface ToastItem {
  id: string
  message: string
  onPress?: () => void
}

// Feeds the in-app toast host for iOS messages and actionable mobile toasts.
export const toasts$ = observable<ToastItem[]>([])

const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function pushToast(message: string, onPress?: () => void) {
  while (toasts$.length >= MAX_TOASTS) {
    dismissToast(toasts$[0].id.get())
  }

  const id = `${Date.now()}-${Math.random()}`
  toasts$.push({ id, message, onPress })
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
