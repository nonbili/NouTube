/*
 * Replaces `@/lib/toast`. react-hot-toast needs a DOM, and half of what imports
 * this ends up in the background, so the toaster is loaded only when there is a
 * document to render into.
 */
export function showToast(msg: string) {
  if (typeof document === 'undefined') {
    console.log('[NouTube]', msg)
    return
  }

  void import('react-hot-toast').then(({ toast }) => {
    toast(msg, { icon: '🦦' })
  })
}
