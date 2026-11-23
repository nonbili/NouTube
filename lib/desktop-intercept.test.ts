import { expect, it, mock } from 'bun:test'

it('streams filtered get_watch player data through the Electron protocol handler', async () => {
  let handler!: (request: Request) => Promise<Response>
  let source!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { source = controller } })
  const upstream = new Response(body, { headers: {
    'content-type': 'application/json',
    'content-length': '9999',
    'content-encoding': 'gzip',
    'transfer-encoding': 'chunked',
  } })
  mock.module('electron', () => ({
    net: {},
    session: { fromPartition: () => ({
      setCertificateVerifyProc() {
        throw new Error('YouTube interception must use the default certificate verifier')
      },
      protocol: {
        isProtocolHandled: () => false,
        handle(_scheme: string, callback: typeof handler) { handler = callback },
      },
      fetch: async () => upstream,
    }) },
  }))
  try {
    const { interceptHttpRequest } = await import('../desktop/src/main/lib/intercept')
    interceptHttpRequest()
    // This must resolve before the upstream body is complete.
    const response = await handler(new Request('https://www.youtube.com/youtubei/v1/get_watch'))
    expect(response.headers.get('content-type')).toBe('application/json')
    for (const name of ['content-length', 'content-encoding', 'transfer-encoding']) {
      expect(response.headers.has(name)).toBe(false)
    }
    const reader = response.body!.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    source.enqueue(encoder.encode('[{"playerResponse":{"adPlacements":[{}],"videoDetails":{"videoId":"first"}}},'))
    let early = ''
    while (!early.endsWith(',')) early += decoder.decode((await reader.read()).value)
    expect(JSON.parse(`${early.slice(0, -1)}]`)[0].playerResponse).toEqual({ videoDetails: { videoId: 'first' } })
    source.enqueue(encoder.encode('{"watchNextResponse":{"contents":[]}}]'))
    source.close()
    let rest = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      rest += decoder.decode(value)
    }
    expect(JSON.parse(early + rest)[1]).toEqual({ watchNextResponse: { contents: [] } })
  } finally {
    mock.restore()
  }
})
