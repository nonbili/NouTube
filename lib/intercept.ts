const keys = ['adBreakHeartbeatParams', 'adPlacements', 'adSlots', 'playerAds']

export const RE_INTERCEPT = new RegExp('^/youtubei/v1/(player|search)')

export function transformPlayerResponse(text: string) {
  const data = JSON.parse(text)
  keys.forEach((key) => delete data[key])
  return JSON.stringify(data)
}

export function transformSearchResponse(text: string) {
  const data = JSON.parse(text) as SearchResponse
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
      .map((x) => transformSectionListItem(x))
      .filter(Boolean) as any
  }
  return JSON.stringify(data)
}

function transformSectionListItem(item: SectionListItem) {
  const { videoWithContextRenderer, gridShelfViewModel } = item
  if (
    gridShelfViewModel ||
    videoWithContextRenderer?.navigationEndpoint.commandMetadata.webCommandMetadata.url.startsWith('/shorts')
  ) {
    return undefined
  }
  return item
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
