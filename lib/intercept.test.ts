import { describe, expect, it } from 'bun:test'
import { normalizeBlocklist } from './blocklist'
import { transformBrowseResponse, transformSearchResponse } from './intercept'

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
})
