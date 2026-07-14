import { noutubeSettingsEvent } from './noutube'
import { emit, nouPolicy } from './utils'

const buttonClass = '_nou_translate_btn'
const styleId = '_nou_translate_css'

const commentSelector =
  'ytm-comment-renderer, ytm-comment-thread-renderer, ytd-comment-thread-renderer, ytd-comment-view-model'
const commentTextSelector =
  '#content-text, .comment-text, .comment-content, .YtmCommentRendererText, yt-attributed-string#content-text, yt-formatted-string#content-text'
const actionRowSelector = '.YtmCommentRendererDetails, ytm-comment-actions, #toolbar, #action-menu'

const translateIcon =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>'

function isEnabled() {
  return Boolean(window.NouTube?.getSettings?.()?.translateComments)
}

function ensureStyle() {
  if (document.getElementById(styleId)) {
    return
  }
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .${buttonClass} {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 4px 8px !important;
      margin: 0 !important;
      border: none !important;
      background: transparent !important;
      color: inherit !important;
      opacity: 0.7;
      cursor: pointer;
    }
  `
  ;(document.head || document.documentElement).appendChild(style)
}

function textOf(element: Element) {
  const parts: string[] = []
  const appendBreak = () => {
    if (parts.length && !parts.at(-1)?.endsWith('\n')) parts.push('\n')
  }
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent?.replace(/\s+/g, ' ').trim()
      if (value) parts.push(value, ' ')
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'BR') {
      appendBreak()
      return
    }
    node.childNodes.forEach(visit)
  }
  visit(element)
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function onTranslatePress(event: Event) {
  // comments nest action buttons inside the comment body button, so stop
  // the tap from also expanding or collapsing the comment
  event.preventDefault()
  event.stopPropagation()
  const button = event.currentTarget as HTMLElement
  const comment = button.closest(commentSelector)
  const textEl = comment?.querySelector(commentTextSelector)
  if (!textEl) return
  const text = textOf(textEl)
  if (text.length < 2 || text.length > 12000) return
  const rect = textEl.getBoundingClientRect()
  emit('translate-block', {
    id: `${Date.now()}-${Math.random()}`,
    text,
    x: rect.left,
    y: rect.bottom,
  })
}

function removeButtons() {
  document.querySelectorAll(`.${buttonClass}`).forEach((node) => node.remove())
}

function addButtons() {
  ensureStyle()
  document.querySelectorAll(commentSelector).forEach((comment) => {
    const row = comment.querySelector(actionRowSelector)
    if (!row || row.closest(commentSelector) !== comment) return
    if (row.querySelector(`.${buttonClass}`)) return
    if (!comment.querySelector(commentTextSelector)) return
    const button = document.createElement('button')
    button.className = buttonClass
    button.type = 'button'
    button.setAttribute('aria-label', 'Translate')
    button.innerHTML = nouPolicy.createHTML(translateIcon) as unknown as string
    button.addEventListener('click', onTranslatePress)
    const menu = row.querySelector('.YtmCommentRendererMenu')
    row.insertBefore(button, menu)
  })
}

function update() {
  if (isEnabled()) {
    addButtons()
  } else {
    removeButtons()
  }
}

export function installCommentTranslateButtons() {
  if (!window.isAndroid) {
    return
  }
  update()
  window.addEventListener(noutubeSettingsEvent, update)

  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled || !isEnabled()) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      addButtons()
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}
