import { expect, it } from 'bun:test'
import { transformWatchResponseStream } from './watch-response-stream'
import { transformGetWatchResponse } from './intercept'

it('releases filtered player data before watch-next arrives', async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { source = controller } })
  const reader = transformWatchResponseStream(body, transformGetWatchResponse).getReader()
  const encoder = new TextEncoder()
  source.enqueue(encoder.encode('[{"playerResponse":{"adPlacements":[{}],"videoDetails":{"videoId":"first"}}},'))
  let early = ''
  while (!early.endsWith(',')) early += new TextDecoder().decode((await reader.read()).value)
  expect(JSON.parse(`${early.slice(0, -1)}]`)[0].playerResponse).toEqual({ videoDetails: { videoId: 'first' } })
  source.enqueue(encoder.encode('{"watchNextResponse":{"contents":[]}}]'))
  source.close()
  let rest = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    rest += new TextDecoder().decode(value)
  }
  expect(JSON.parse(early + rest)[1]).toEqual({ watchNextResponse: { contents: [] } })
})

it('handles arbitrary byte boundaries, escaped strings, Unicode and ads allowed', async () => {
  const data = [{ playerResponse: { playerAds: [{}], videoDetails: { title: '🎵 "quoted" \\ } ], café' } } }, { watchNextResponse: {} }]
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
    controller.close()
  } })
  const result = await new Response(transformWatchResponseStream(body, (text) => transformGetWatchResponse(text, { blockAds: false }))).json()
  expect(result).toEqual(data)
})

it('does not release an incomplete player response', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode('[{"playerResponse":{"playerAds":[{}]'))
    controller.close()
  } })
  await expect(new Response(transformWatchResponseStream(body, transformGetWatchResponse)).text()).rejects.toThrow('Incomplete')
})
