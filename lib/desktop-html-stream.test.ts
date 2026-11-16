import { expect, it } from 'bun:test'
import { transformHtmlStream } from '../desktop/src/main/lib/html-stream'

const streamOf = (text: string, size: number) => {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size))
      controller.close()
    },
  })
}

const run = (html: string, size: number, transforms: Record<string, (json: string) => string>) =>
  new Response(transformHtmlStream(streamOf(html, size), transforms)).text()

const dropAds = (json: string) => {
  const data = JSON.parse(json)
  delete data.adPlacements
  return JSON.stringify(data)
}

const html = [
  '<html><head><script src="/base.js"></script></head><body>',
  '<script>var ytInitialPlayerResponse = {"adPlacements":[{}],"title":"🎵 \\"}\\" café"};</script>',
  '<div>{ not json }</div>',
  '<script>var ytInitialData = {"adPlacements":[1],"items":[{"a":"]"}]};</script>',
  '</body></html>',
].join('')

const expected = html
  .replace('{"adPlacements":[{}],"title":"🎵 \\"}\\" café"}', '{"title":"🎵 \\"}\\" café"}')
  .replace('{"adPlacements":[1],"items":[{"a":"]"}]}', '{"items":[{"a":"]"}]}')

it('rewrites embedded objects across arbitrary chunk boundaries', async () => {
  for (const size of [1, 2, 3, 7, 64, 100000]) {
    expect(await run(html, size, { ytInitialData: dropAds, ytInitialPlayerResponse: dropAds })).toBe(expected)
  }
})

it('releases the document before the embedded object is complete', async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { source = controller } })
  const reader = transformHtmlStream(body, { ytInitialData: dropAds }).getReader()
  source.enqueue(new TextEncoder().encode('<head><script src="/base.js"></script></head><script>var ytInitialData = {"a":'))
  const { value } = await reader.read()
  expect(new TextDecoder().decode(value)).toStartWith('<head><script src="/base.js"></script>')
  source.close()
})

it('escapes script-breaking characters and keeps the original on failure', async () => {
  const page = '<script>var ytInitialData = {"t":"x"};var ytInitialPlayerResponse = {"broken":1};</script>'
  const result = await run(page, 5, {
    ytInitialData: () => JSON.stringify({ t: '</script>&' }),
    ytInitialPlayerResponse: () => {
      throw new Error('boom')
    },
  })
  expect(result).toBe('<script>var ytInitialData = {"t":"\\u003c/script\\u003e\\u0026"};var ytInitialPlayerResponse = {"broken":1};</script>')
})

it('passes through pages without markers and truncated objects', async () => {
  expect(await run('<p>plain</p>', 3, { ytInitialData: dropAds })).toBe('<p>plain</p>')
  expect(await run('<script>var ytInitialData = {"a":[', 4, { ytInitialData: dropAds })).toBe(
    '<script>var ytInitialData = {"a":[',
  )
})
