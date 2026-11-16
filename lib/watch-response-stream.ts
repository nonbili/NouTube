// get_watch streams a JSON array: the small player response arrives before the
// much larger watch-next response. Release each complete entry without waiting
// for the rest of the array, but never release unfiltered player data.
export function transformWatchResponseStream(
  body: ReadableStream<Uint8Array>,
  transform: (text: string) => string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let scan = 0
  let depth = 0
  let inString = false
  let escaped = false
  let entryStart = -1

  const consume = (controller: TransformStreamDefaultController<Uint8Array>) => {
    for (; scan < buffer.length; scan++) {
      const char = buffer[scan]
      if (entryStart < 0) {
        if (/\s|\[|\]|,/.test(char)) {
          controller.enqueue(encoder.encode(char))
          continue
        }
        if (char !== '{') throw new Error('Unexpected get_watch array entry')
        entryStart = scan
        depth = 1
        continue
      }
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
      } else if (char === '"') inString = true
      else if (char === '{' || char === '[') depth++
      else if (char === '}' || char === ']') {
        if (--depth === 0) {
          const result = transform(`[${buffer.slice(entryStart, scan + 1)}]`)
          controller.enqueue(encoder.encode(result.slice(1, -1)))
          entryStart = -1
        }
      }
    }
    if (entryStart < 0) {
      buffer = ''
      scan = 0
    } else if (entryStart > 0) {
      buffer = buffer.slice(entryStart)
      scan -= entryStart
      entryStart = 0
    }
  }

  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      consume(controller)
    },
    flush(controller) {
      buffer += decoder.decode()
      consume(controller)
      if (entryStart >= 0) throw new Error('Incomplete get_watch array entry')
    },
  }))
}
