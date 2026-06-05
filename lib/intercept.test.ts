import { describe, expect, it } from 'bun:test'
import { normalizeBlocklist } from './blocklist'
import {
  transformBrowseResponse,
  transformGetWatchResponse,
  transformPlayerResponse,
  transformSearchResponse,
} from './intercept'

describe('intercept blocklist filtering', () => {
  const blocklist = normalizeBlocklist({
    channels: [{ id: 'channel', value: 'channel1', enabled: true, createdAt: 1 }],
    keywords: [{ id: 'keyword', value: 'spoiler', enabled: true, createdAt: 1 }],
  })

  it('removes search items by channel and keyword', () => {
    const response = {
      contents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    videoWithContextRenderer: {
                      title: { runs: [{ text: 'Normal video' }] },
                      shortBylineText: { runs: [{ text: 'Channel1' }] },
                      navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/watch?v=1' } } },
                    },
                  },
                  {
                    videoWithContextRenderer: {
                      title: { runs: [{ text: 'Spoiler explained' }] },
                      shortBylineText: { runs: [{ text: 'Other channel' }] },
                      navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/watch?v=2' } } },
                    },
                  },
                  {
                    videoWithContextRenderer: {
                      title: { runs: [{ text: 'Keep me' }] },
                      shortBylineText: { runs: [{ text: 'Other channel' }] },
                      navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/watch?v=3' } } },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }

    const transformed = JSON.parse(transformSearchResponse(JSON.stringify(response), blocklist))
    const items = transformed.contents.sectionListRenderer.contents[0].itemSectionRenderer.contents

    expect(items).toHaveLength(1)
    expect(items[0].videoWithContextRenderer.title.runs[0].text).toBe('Keep me')
  })

  it('keeps shorts in search when only blocklist filtering is requested', () => {
    const response = {
      contents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    videoWithContextRenderer: {
                      title: { runs: [{ text: 'Keep short' }] },
                      shortBylineText: { runs: [{ text: 'Other channel' }] },
                      navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/shorts/1' } } },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }

    const transformed = JSON.parse(transformSearchResponse(JSON.stringify(response), blocklist, { hideShorts: false }))
    const items = transformed.contents.sectionListRenderer.contents[0].itemSectionRenderer.contents

    expect(items).toHaveLength(1)
  })

  it('removes matching shorts even when generic shorts filtering is off', () => {
    const response = {
      contents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    videoWithContextRenderer: {
                      title: { runs: [{ text: 'Spoiler short' }] },
                      shortBylineText: { runs: [{ text: 'Other channel' }] },
                      navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/shorts/1' } } },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }

    const transformed = JSON.parse(transformSearchResponse(JSON.stringify(response), blocklist, { hideShorts: false }))
    const items = transformed.contents.sectionListRenderer.contents[0].itemSectionRenderer.contents

    expect(items).toHaveLength(0)
  })

  it('removes browse rich grid items by channel and keyword', () => {
    const response = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  richGridRenderer: {
                    contents: [
                      {
                        richItemRenderer: {
                          content: {
                            videoRenderer: {
                              title: { runs: [{ text: 'Normal video' }] },
                              ownerText: { runs: [{ text: 'Channel1' }] },
                            },
                          },
                        },
                      },
                      {
                        richItemRenderer: {
                          content: {
                            videoRenderer: {
                              title: { runs: [{ text: 'Spoiler video' }] },
                              ownerText: { runs: [{ text: 'Other channel' }] },
                            },
                          },
                        },
                      },
                      {
                        richItemRenderer: {
                          content: {
                            videoRenderer: {
                              title: { runs: [{ text: 'Keep me' }] },
                              ownerText: { runs: [{ text: 'Other channel' }] },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    }

    const transformed = JSON.parse(transformBrowseResponse(JSON.stringify(response), blocklist))
    const items = transformed.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents

    expect(items).toHaveLength(1)
    expect(items[0].richItemRenderer.content.videoRenderer.title.runs[0].text).toBe('Keep me')
  })

  it('removes lockupViewModel items in browse by channel name, URL, or ID', () => {
    const response = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  richGridRenderer: {
                    contents: [
                      {
                        richItemRenderer: {
                          content: {
                            lockupViewModel: {
                              contentMetadata: {
                                runs: [
                                  {
                                    text: 'BBC Music',
                                    navigationEndpoint: {
                                      browseEndpoint: {
                                        browseId: 'UC_bbc',
                                        canonicalBaseUrl: '/@bbcmusic',
                                      },
                                    },
                                  },
                                  { text: ' • ' },
                                  { text: '1M views' },
                                ],
                              },
                            },
                          },
                        },
                      },
                      {
                        richItemRenderer: {
                          content: {
                            lockupViewModel: {
                              contentMetadata: {
                                runs: [
                                  {
                                    text: 'Keep me',
                                    navigationEndpoint: {
                                      browseEndpoint: {
                                        browseId: 'UC_keep',
                                        canonicalBaseUrl: '/@keep',
                                      },
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    }

    // Test channel name blocking
    const blocklistByName = normalizeBlocklist({
      channels: [{ id: '1', value: 'BBC Music', enabled: true, createdAt: 1 }],
      keywords: [],
    })
    const transformedName = JSON.parse(transformBrowseResponse(JSON.stringify(response), blocklistByName))
    const itemsName = transformedName.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents
    expect(itemsName).toHaveLength(1)
    expect(itemsName[0].richItemRenderer.content.lockupViewModel.contentMetadata.runs[0].text).toBe('Keep me')

    // Test channel handle/URL blocking
    const blocklistByUrl = normalizeBlocklist({
      channels: [{ id: '1', value: '@bbcmusic', enabled: true, createdAt: 1 }],
      keywords: [],
    })
    const transformedUrl = JSON.parse(transformBrowseResponse(JSON.stringify(response), blocklistByUrl))
    const itemsUrl = transformedUrl.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents
    expect(itemsUrl).toHaveLength(1)
    expect(itemsUrl[0].richItemRenderer.content.lockupViewModel.contentMetadata.runs[0].text).toBe('Keep me')

    // Test channel ID blocking
    const blocklistById = normalizeBlocklist({
      channels: [{ id: '1', value: 'UC_bbc', enabled: true, createdAt: 1 }],
      keywords: [],
    })
    const transformedId = JSON.parse(transformBrowseResponse(JSON.stringify(response), blocklistById))
    const itemsId = transformedId.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents
    expect(itemsId).toHaveLength(1)
    expect(itemsId[0].richItemRenderer.content.lockupViewModel.contentMetadata.runs[0].text).toBe('Keep me')
  })
})

describe('intercept original title rewriting', () => {
  it('rewrites player display metadata from videoDetails title when enabled', () => {
    const response = {
      videoDetails: {
        title: 'Original title',
      },
      microformat: {
        playerMicroformatRenderer: {
          title: { simpleText: 'Translated title' },
        },
      },
    }

    const transformed = JSON.parse(
      transformPlayerResponse(JSON.stringify(response), undefined, { showOriginalVideoTitle: true }),
    )

    expect(transformed.videoDetails.title).toBe('Original title')
    expect(transformed.microformat.playerMicroformatRenderer.title.simpleText).toBe('Original title')
  })

  it('leaves player display metadata translated when disabled', () => {
    const response = {
      videoDetails: {
        title: 'Original title',
      },
      microformat: {
        playerMicroformatRenderer: {
          title: { simpleText: 'Translated title' },
        },
      },
    }

    const transformed = JSON.parse(transformPlayerResponse(JSON.stringify(response)))

    expect(transformed.microformat.playerMicroformatRenderer.title.simpleText).toBe('Translated title')
  })

  it('rewrites wrapped get_watch player metadata when enabled', () => {
    const response = [
      {
        playerResponse: {
          videoDetails: {
            title: 'Original title',
          },
          microformat: {
            playerMicroformatRenderer: {
              title: { simpleText: 'Translated title' },
            },
          },
        },
      },
    ]

    const transformed = JSON.parse(transformGetWatchResponse(JSON.stringify(response), { showOriginalVideoTitle: true }))

    expect(transformed[0].playerResponse.microformat.playerMicroformatRenderer.title.simpleText).toBe('Original title')
  })

  it('rewrites browse renderer titles only when an original title field exists', () => {
    const response = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  richGridRenderer: {
                    contents: [
                      {
                        richItemRenderer: {
                          content: {
                            videoRenderer: {
                              title: { runs: [{ text: 'Translated title' }] },
                              originalTitle: { simpleText: 'Original title' },
                            },
                          },
                        },
                      },
                      {
                        richItemRenderer: {
                          content: {
                            videoRenderer: {
                              title: { runs: [{ text: 'Still translated' }] },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    }

    const transformed = JSON.parse(
      transformBrowseResponse(JSON.stringify(response), undefined, { showOriginalVideoTitle: true }),
    )
    const items = transformed.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents

    expect(items[0].richItemRenderer.content.videoRenderer.title.runs[0].text).toBe('Original title')
    expect(items[1].richItemRenderer.content.videoRenderer.title.runs[0].text).toBe('Still translated')
  })

  it('rewrites search renderer titles while preserving shorts visibility option', () => {
    const response = {
      contents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    videoWithContextRenderer: {
                      title: { runs: [{ text: 'Translated short' }] },
                      originalTitle: { runs: [{ text: 'Original short' }] },
                      shortBylineText: { runs: [{ text: 'Other channel' }] },
                      navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/shorts/1' } } },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }

    const transformed = JSON.parse(
      transformSearchResponse(JSON.stringify(response), undefined, {
        hideShorts: false,
        showOriginalVideoTitle: true,
      }),
    )
    const items = transformed.contents.sectionListRenderer.contents[0].itemSectionRenderer.contents

    expect(items).toHaveLength(1)
    expect(items[0].videoWithContextRenderer.title.runs[0].text).toBe('Original short')
  })
})
