import { useEffect } from 'react'
import { isEditableTarget, openPastedUrl } from '../paste-url'

/* Paste a YouTube URL anywhere in the app shell to open it. */
export function usePasteUrl() {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) {
        return
      }
      const text = event.clipboardData?.getData('text')
      if (text) {
        openPastedUrl(text)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])
}
