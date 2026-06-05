import { noutubeSettingsEvent } from './noutube'

const countClass = '_nou_dislike_count'
const loadedClass = '_nou_dislike_loaded'
const styleId = '_nou_dislike_css'
const apiUrl = 'https://returnyoutubedislikeapi.com/votes?videoId='

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
let currentVideoId = ''
let requestId = 0

const dislikeContainerSelector = ['dislike-button-view-model', '#segmented-dislike-button'].join(',')
const dislikeButtonSelector = ['dislike-button-view-model button', '#segmented-dislike-button button'].join(',')
const labelSelector = [
  '.ytSpecButtonShapeNextButtonTextContent',
  '.ytSpecButtonShapeNextButtonTextContent span',
  '.yt-core-attributed-string',
  '.button-renderer-text',
].join(',')

function isEnabled() {
  return Boolean(window.NouTube?.getSettings?.()?.showDislikes)
}

function getVideoId() {
  const url = new URL(location.href)
  if (url.hostname === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] || ''
  }
  if (url.pathname === '/shorts') {
    return ''
  }
  if (url.pathname.startsWith('/shorts/')) {
    return url.pathname.split('/')[2] || ''
  }
  return url.searchParams.get('v') || ''
}

function formatCount(value: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return String(value)
  }
}

function ensureStyle() {
  if (document.getElementById(styleId)) {
    return
  }
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .${countClass} {
      display: inline-flex !important;
      align-items: center !important;
      margin-left: 6px !important;
      font: inherit !important;
      white-space: nowrap !important;
    }
  `
  ;(document.head || document.documentElement).appendChild(style)
}

function removeCounts() {
  document.querySelectorAll<HTMLElement>(`.${countClass}`).forEach((node) => {
    const button = node.closest<HTMLElement>('button')
    if (button?.dataset.nouDislikeIconButton === 'true') {
      button.classList.add('ytSpecButtonShapeNextIconButton')
      button.classList.remove('ytSpecButtonShapeNextIconLeading')
      delete button.dataset.nouDislikeIconButton
    }
    const originalText = node.dataset.nouOriginalText
    if (originalText != null && node.dataset.nouReused === 'true') {
      node.textContent = originalText
      node.classList.remove(countClass)
      delete node.dataset.nouOriginalText
      delete node.dataset.nouReused
      return
    }
    node.remove()
  })
  document.querySelectorAll(`.${loadedClass}`).forEach((node) => node.classList.remove(loadedClass))
}

function removeStaleCounts(buttons: HTMLElement[]) {
  const activeButtons = new Set(buttons)
  document.querySelectorAll<HTMLElement>(`.${countClass}`).forEach((node) => {
    const button = node.closest<HTMLElement>('button')
    if (!button || !activeButtons.has(button)) {
      node.remove()
    }
  })
}

function isVisible(el: Element) {
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function getDislikeButtons() {
  const buttons = [
    ...Array.from(document.querySelectorAll<HTMLElement>(dislikeButtonSelector)),
    ...Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          'button[aria-label*="Dislike"]',
          'button[aria-label*="dislike"]',
          '[role="button"][aria-label*="Dislike"]',
          '[role="button"][aria-label*="dislike"]',
        ].join(','),
      ),
    ),
  ]

  return [...new Set(buttons)].filter((button) => {
    if (!isVisible(button)) {
      return false
    }
    if (button.closest(dislikeContainerSelector)) {
      return true
    }
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`
    if (!/dislike/i.test(label)) {
      return false
    }
    return Boolean(
      button.closest(
        [
          'ytd-segmented-like-dislike-button-renderer',
          'segmented-like-dislike-button-view-model',
          'ytm-slim-video-action-bar-renderer',
          'ytm-like-button-renderer',
        ].join(','),
      ),
    )
  })
}

function renderCount(count: string) {
  ensureStyle()
  const buttons = getDislikeButtons()
  removeStaleCounts(buttons)
  for (const button of buttons) {
    let node = button.querySelector<HTMLElement>(`.${countClass}`)
    if (node && !node.classList.contains('ytSpecButtonShapeNextButtonTextContent')) {
      node.remove()
      node = null
    }
    if (!node) {
      node = Array.from(button.querySelectorAll<HTMLElement>(labelSelector)).find(isVisible) || null
      if (node) {
        node.dataset.nouOriginalText = node.textContent || ''
        node.dataset.nouReused = 'true'
        node.classList.add(countClass)
      } else {
        node = document.createElement('div')
        node.className = `ytSpecButtonShapeNextButtonTextContent ${countClass}`
        const feedback = button.querySelector('yt-touch-feedback-shape')
        button.insertBefore(node, feedback || null)
        if (button.classList.contains('ytSpecButtonShapeNextIconButton')) {
          button.dataset.nouDislikeIconButton = 'true'
          button.classList.remove('ytSpecButtonShapeNextIconButton')
          button.classList.add('ytSpecButtonShapeNextIconLeading')
        }
      }
    }
    if (node.textContent !== count) {
      node.textContent = count
    }
    button.classList.add(loadedClass)
  }
}

async function fetchCount(videoId: string) {
  const cached = cache.get(videoId)
  if (cached) {
    return cached
  }
  const existing = pending.get(videoId)
  if (existing) {
    return existing
  }
  const promise = fetch(`${apiUrl}${encodeURIComponent(videoId)}`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Return YouTube Dislike responded with ${res.status}`)
      }
      const data = await res.json()
      const count = typeof data?.dislikes === 'number' ? formatCount(data.dislikes) : ''
      if (count) {
        cache.set(videoId, count)
      }
      return count
    })
    .finally(() => pending.delete(videoId))
  pending.set(videoId, promise)
  return promise
}

async function updateDislikes() {
  if (!isEnabled()) {
    currentVideoId = ''
    removeCounts()
    return
  }

  const videoId = getVideoId()
  if (!videoId) {
    currentVideoId = ''
    removeCounts()
    return
  }

  const id = ++requestId
  if (videoId !== currentVideoId) {
    currentVideoId = videoId
    removeCounts()
  }

  try {
    const count = await fetchCount(videoId)
    if (id === requestId && videoId === currentVideoId && count) {
      renderCount(count)
    }
  } catch (error) {
    console.warn('NouScript dislikes:', error)
  }
}

export function installDislikeCount() {
  updateDislikes()
  window.addEventListener(noutubeSettingsEvent, updateDislikes)
  window.addEventListener('yt-navigate-finish', updateDislikes)
  document.addEventListener('yt-navigate-finish', updateDislikes)

  const observer = new MutationObserver(() => {
    if (currentVideoId && cache.has(currentVideoId)) {
      renderCount(cache.get(currentVideoId) || '')
      return
    }
    updateDislikes()
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}
