import { describe, expect, it } from 'bun:test'
import { pruneExpiredUndoToasts, runUndoAction, showUndoToast, undoToasts$ } from './undo-toast'

describe('undo toast', () => {
  it('keeps earlier actions available when another toast is shown', () => {
    const undone: string[] = []
    showUndoToast('First', () => undone.push('first'))
    showUndoToast('Second', () => undone.push('second'))

    runUndoAction()
    expect(undone).toEqual(['second'])
    expect(undoToasts$.get().at(-1)?.message).toBe('First')

    runUndoAction()
    expect(undone).toEqual(['second', 'first'])
  })

  it('expires queued actions against wall-clock time', () => {
    let undone = false
    showUndoToast('Expired', () => {
      undone = true
    })

    pruneExpiredUndoToasts(Date.now() + 6000)
    runUndoAction()

    expect(undone).toBe(false)
    expect(undoToasts$.get()).toEqual([])
  })

  it('keeps at most three actionable rows', () => {
    const undone: number[] = []
    for (let index = 1; index <= 4; index += 1) {
      showUndoToast(`Item ${index}`, () => undone.push(index))
    }

    expect(undoToasts$.get().map((toast) => toast.message)).toEqual(['Item 2', 'Item 3', 'Item 4'])
    runUndoAction(undoToasts$.get()[0].id)
    expect(undone).toEqual([2])
    pruneExpiredUndoToasts(Date.now() + 6000)
  })
})
