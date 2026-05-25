import {
  blocklistTextMatches,
  blocklistTextsMatch,
  normalizeBlocklist,
  type BlocklistSnapshot,
} from './blocklist'

const keys = ['adBreakHeartbeatParams', 'adPlacements', 'adSlots', 'playerAds']

export const RE_INTERCEPT = new RegExp('^/youtubei/v1/(browse|get_watch|next|player|search)')

export function transformGetWatchResponse(text: string) {
  const data = JSON.parse(text)
  data[0].playerResponse = stripAdKeys(data[0].playerResponse)
  return JSON.stringify(data)
}

function stripAdKeys(data: any) {
  keys.forEach((key) => delete data[key])
  return data
}

export function transformPlayerResponse(text: string) {
  const data = JSON.parse(text)
  stripAdKeys(data)
  return JSON.stringify(data)
}

export function transformSearchResponse(text: string, blocklist?: BlocklistSnapshot, options: { hideShorts?: boolean } = {}) {
  const data = JSON.parse(text) as SearchResponse
  const hideShorts = options.hideShorts !== false
  const sectionListRenderer =
    // mobile
    data.contents?.sectionListRenderer ||
    // desktop
    data.contents?.twoColumnSearchResultsRenderer?.primaryContents.sectionListRenderer
  const itemSectionRenderer =
    sectionListRenderer?.contents[0].itemSectionRenderer ||
    data.onResponseReceivedCommands?.[0].appendContinuationItemsAction?.continuationItems?.[0].itemSectionRenderer

  if (itemSectionRenderer) {
    itemSectionRenderer.contents = itemSectionRenderer.contents
      .map((x) => transformSectionListItem(x, blocklist, hideShorts))
      .filter(Boolean) as any
  }
  filterListResponse(data, blocklist)
  return JSON.stringify(data)
}

export function transformBrowseResponse(text: string, blocklist?: BlocklistSnapshot) {
  const data = JSON.parse(text)
  filterListResponse(data, blocklist)
  return JSON.stringify(data)
}

function transformSectionListItem(item: SectionListItem, blocklist: BlocklistSnapshot | undefined, hideShorts: boolean) {
  const { videoWithContextRenderer, gridShelfViewModel } = item
  if (
    hideShorts &&
    (gridShelfViewModel ||
      videoWithContextRenderer?.navigationEndpoint.commandMetadata.webCommandMetadata.url.startsWith('/shorts'))
  ) {
    return undefined
  }
  if (itemMatchesBlocklist(item, blocklist)) {
    return undefined
  }
  return item
}

function filterListResponse(data: any, blocklist?: BlocklistSnapshot) {
  if (!data || typeof data !== 'object') {
    return
  }

  for (const key of Object.keys(data)) {
    const value = data[key]
    if (Array.isArray(value)) {
      data[key] = value.filter((item) => !itemMatchesBlocklist(item, blocklist))
      data[key].forEach((item: any) => filterListResponse(item, blocklist))
    } else if (value && typeof value === 'object') {
      filterListResponse(value, blocklist)
    }
  }
}

function itemMatchesBlocklist(item: any, blocklist?: BlocklistSnapshot) {
  const normalized = normalizeBlocklist(blocklist)
  if (!normalized.channels.length && !normalized.keywords.length) {
    return false
  }

  return getDirectRenderers(item).some((renderer) => rendererMatchesBlocklist(renderer, normalized))
}

function getDirectRenderers(item: any): any[] {
  if (!item || typeof item !== 'object') {
    return []
  }

  const renderers = [
    item.videoRenderer,
    item.compactVideoRenderer,
    item.gridVideoRenderer,
    item.videoWithContextRenderer,
    item.reelItemRenderer,
    item.lockupViewModel,
    item.richItemRenderer?.content?.videoRenderer,
    item.richItemRenderer?.content?.lockupViewModel,
  ].filter(Boolean)

  return renderers.length ? renderers : []
}

function rendererMatchesBlocklist(renderer: any, blocklist: BlocklistSnapshot) {
  const titleTexts = extractTitleTexts(renderer)
  const channelTexts = extractChannelTexts(renderer)

  return (
    blocklistTextsMatch(titleTexts, blocklist.keywords) ||
    blocklistTextsMatch(channelTexts, blocklist.channels)
  )
}

function extractTitleTexts(renderer: any): string[] {
  return [
    textFromNode(renderer?.title),
    textFromNode(renderer?.headline),
    renderer?.metadata?.lockupMetadataViewModel?.title?.content,
  ].filter(Boolean)
}

function extractChannelTexts(renderer: any): string[] {
  return [
    textFromNode(renderer?.ownerText),
    textFromNode(renderer?.shortBylineText),
    textFromNode(renderer?.longBylineText),
    textFromNode(renderer?.owner?.videoOwnerRenderer?.title),
    renderer?.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl,
    renderer?.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
    renderer?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl,
    renderer?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
    renderer?.metadata?.lockupMetadataViewModel?.metadata?.content,
    renderer?.contentMetadata?.runs?.map((run: any) => run?.text).join(' '),
  ].filter(Boolean)
}

function textFromNode(node: any): string {
  if (!node) {
    return ''
  }
  if (typeof node === 'string') {
    return node
  }
  if (typeof node.simpleText === 'string') {
    return node.simpleText
  }
  if (typeof node.content === 'string') {
    return node.content
  }
  if (Array.isArray(node.runs)) {
    return node.runs.map((run: any) => run?.text || '').join('')
  }
  return ''
}

interface SearchResponse {
  // 1st page
  contents?: {
    twoColumnSearchResultsRenderer?: {
      primaryContents: {
        sectionListRenderer?: {
          contents: SectionList[]
        }
      }
    }
    sectionListRenderer?: {
      contents: SectionList[]
    }
  }
  // 2nd page
  onResponseReceivedCommands?: {
    appendContinuationItemsAction?: {
      continuationItems?: SectionList[]
    }
  }[]
}

interface SectionList {
  itemSectionRenderer?: {
    contents: SectionListItem[]
  }
}

interface SectionListItem {
  videoWithContextRenderer?: {
    navigationEndpoint: {
      commandMetadata: {
        webCommandMetadata: {
          url: string
        }
      }
    }
  }
  gridShelfViewModel?: any
}
