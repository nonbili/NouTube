import { blocklistChannelsMatch, blocklistTextMatches, blocklistTextsMatch, createDefaultBlocklistSnapshot } from '../lib/blocklist'
import { noutubeBlocklistEvent } from './noutube'

const blockedClass = '_nou_blocked'
const styleId = '_nou_blocklist_css'

const itemSelector = [
  'ytm-media-item',
  'ytm-compact-video-renderer',
  'ytm-video-with-context-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-rich-item-renderer',
  'yt-lockup-view-model',
  'yt-lockup-metadata-view-model',
].join(',')

function ensureStyle() {
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `.${blockedClass}{display:none!important;}`
  ;(document.head || document.documentElement).appendChild(style)
}

function getBlocklist() {
  return window.NouTube?.getBlocklist?.() || createDefaultBlocklistSnapshot()
}

function getText(el: Element | null | undefined) {
  return el?.textContent?.trim() || ''
}

function getTitleTexts(item: Element) {
  return [
    getText(item.querySelector('h3')),
    getText(item.querySelector('h4')),
    getText(item.querySelector('#video-title')),
    getText(item.querySelector('a#video-title')),
    getText(item.querySelector('.yt-lockup-metadata-view-model-wiz__title')),
    getText(item.querySelector('.yt-core-attributed-string[role="text"]')),
  ].filter(Boolean)
}

function getChannelTexts(item: Element) {
  const channelLinks = Array.from(
    item.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/@"],a[href^="/channel/"],a[href^="/c/"],a[href^="/user/"],a[href*="youtube.com/@"],a[href*="youtube.com/channel/"]',
    ),
  )

  return [
    ...channelLinks.flatMap((link) => [link.textContent?.trim(), link.getAttribute('href') || '', link.href || '']),
    getText(item.querySelector('.yt-lockup-metadata-view-model-wiz__metadata')),
    getText(item.querySelector('ytm-badge-and-byline-renderer')),
    getText(item.querySelector('ytd-channel-name')),
    getText(item.querySelector('#channel-name')),
  ].filter(Boolean)
}

function itemMatches(item: Element) {
  const blocklist = getBlocklist()
  return (
    blocklistTextsMatch(getTitleTexts(item), blocklist.keywords) ||
    blocklistChannelsMatch(getChannelTexts(item), blocklist.channels) ||
    blocklistTextMatches(item.getAttribute('aria-label') || '', blocklist.keywords)
  )
}

function applyBlocklist(root: ParentNode = document) {
  ensureStyle()
  root.querySelectorAll?.(itemSelector).forEach((item) => {
    item.classList.toggle(blockedClass, itemMatches(item))
  })
}

export function installBlocklistFilter() {
  applyBlocklist()
  window.addEventListener(noutubeBlocklistEvent, () => applyBlocklist())

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          if (node.matches(itemSelector)) {
            node.classList.toggle(blockedClass, itemMatches(node))
          }
          const parentItem = node.closest?.(itemSelector)
          if (parentItem) {
            parentItem.classList.toggle(blockedClass, itemMatches(parentItem))
          }
          applyBlocklist(node)
        }
      })
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}
