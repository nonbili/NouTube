import { removeTrackingParams } from '@/lib/tracking-url'

function getCopiedText() {
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    if (active.selectionStart !== null && active.selectionEnd !== null && active.selectionStart !== active.selectionEnd) {
      return active.value.slice(active.selectionStart, active.selectionEnd)
    }
    return active.value
  }
  return window.getSelection()?.toString() ?? ''
}

export function interceptClipboard() {
  const writeText = navigator.clipboard?.writeText
  if (writeText) {
    navigator.clipboard.writeText = async function (text) {
      const clean = removeTrackingParams(text)
      return writeText.call(this, clean || text)
    }
  }

  document.addEventListener(
    'copy',
    (event) => {
      const text = event.clipboardData?.getData('text/plain') || getCopiedText()
      const clean = removeTrackingParams(text)
      if (!text || clean === text || !event.clipboardData) {
        return
      }
      event.preventDefault()
      event.clipboardData.setData('text/plain', clean)
    },
    { capture: true },
  )
}
