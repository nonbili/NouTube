import { ui$ } from '@/states/ui'
import { fixSharingUrl } from './page'
import { isSupportedUrl } from './supported-url'

/* Paste is only intercepted outside text fields, so pasting into YouTube's
 * search box or a comment stays a plain paste. */
export function isEditableTarget(target: any) {
  if (!target) {
    return false
  }
  const tag = target.tagName?.toUpperCase?.()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
}

export function getPastedUrl(text: string) {
  const value = (text || '').trim()
  if (!value) {
    return ''
  }
  if (value.startsWith('noutube:')) {
    return value
  }
  const fixed = fixSharingUrl(value)
  return isSupportedUrl(fixed) ? fixed : ''
}

/* Returns whether the clipboard held a URL we handle. */
export function openPastedUrl(text: string) {
  const url = getPastedUrl(text)
  if (!url) {
    return false
  }
  ui$.urlModalUrl.set(url)
  ui$.urlModalOpen.set(true)
  return true
}
