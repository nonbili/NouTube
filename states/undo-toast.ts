import { observable } from '@legendapp/state'

const UNDO_TIMEOUT_MS = 5000
const MAX_UNDO_TOASTS = 3

export interface UndoToastItem {
  id: string
  message: string
  expiresAt: number
}

export const undoToasts$ = observable<UndoToastItem[]>([])

const undoActions = new Map<string, () => void>()
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function showUndoToast(message: string, onUndo: () => void) {
  while (undoToasts$.length >= MAX_UNDO_TOASTS) {
    const oldestId = undoToasts$[0].id.get()
    dismissUndoToast(oldestId)
  }

  const id = `${Date.now()}-${Math.random()}`
  undoActions.set(id, onUndo)
  undoToasts$.push({ id, message, expiresAt: Date.now() + UNDO_TIMEOUT_MS })
  dismissTimers.set(id, setTimeout(() => dismissUndoToast(id), UNDO_TIMEOUT_MS))
}

export function dismissUndoToast(id = undoToasts$.get().at(-1)?.id) {
  if (!id) {
    return
  }

  const timer = dismissTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    dismissTimers.delete(id)
  }
  undoActions.delete(id)
  undoToasts$.set(undoToasts$.get().filter((toast) => toast.id !== id))
}

export function runUndoAction(id = undoToasts$.get().at(-1)?.id) {
  if (!id) {
    return
  }
  const action = undoActions.get(id)
  dismissUndoToast(id)
  action?.()
}

export function pruneExpiredUndoToasts(now = Date.now()) {
  const expiredIds = undoToasts$
    .get()
    .filter((toast) => toast.expiresAt <= now)
    .map((toast) => toast.id)
  expiredIds.forEach((id) => dismissUndoToast(id))
}
