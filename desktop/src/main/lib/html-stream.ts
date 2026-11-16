// The watch page embeds its JSON (ytInitialPlayerResponse, ytInitialData) well
// past the first half of the document. Buffering the whole page to rewrite it
// holds back the <head> scripts the player needs, so pass the HTML through as
// it arrives and only hold back each embedded object while it is rewritten.
export function transformHtmlStream(
  body: ReadableStream<Uint8Array>,
  transforms: Record<string, (json: string) => string>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const pending = new Map(Object.entries(transforms).map(([key, fn]) => [`${key} =`, { key, fn }]))
  const keep = Math.max(0, ...[...pending.keys()].map((marker) => marker.length - 1))
  let buffer = ''
  // The embedded object being captured, starting at buffer[0].
  let current: { key: string; fn: (json: string) => string } | null = null
  let afterMarker = false
  let scan = 0
  let depth = 0
  let inString = false
  let escaped = false

  const emit = (controller: TransformStreamDefaultController<Uint8Array>, text: string) => {
    if (text) controller.enqueue(encoder.encode(text))
  }

  const capture = (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (afterMarker) {
      const start = buffer.search(/\S/)
      if (start < 0) {
        emit(controller, buffer)
        buffer = ''
        return false
      }
      emit(controller, buffer.slice(0, start))
      buffer = buffer.slice(start)
      afterMarker = false
      if (buffer[0] !== '{') {
        current = null
        return true
      }
      scan = 1
      depth = 1
      inString = false
      escaped = false
    }
    for (; scan < buffer.length; scan++) {
      const char = buffer[scan]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
      } else if (char === '"') inString = true
      else if (char === '{' || char === '[') depth++
      else if ((char === '}' || char === ']') && --depth === 0) {
        const json = buffer.slice(0, scan + 1)
        let result = json
        try {
          result = escapeForScriptTag(current!.fn(json))
        } catch (e) {
          console.error(`Failed to transform ${current!.key} inside HTML:`, e)
        }
        emit(controller, result)
        buffer = buffer.slice(scan + 1)
        current = null
        return true
      }
    }
    return false
  }

  const consume = (controller: TransformStreamDefaultController<Uint8Array>, final: boolean) => {
    for (;;) {
      if (current) {
        if (!capture(controller)) return
        continue
      }
      let found: { index: number; marker: string } | null = null
      for (const marker of pending.keys()) {
        const index = buffer.indexOf(marker)
        if (index >= 0 && (!found || index < found.index)) found = { index, marker }
      }
      if (!found) {
        const end = final || pending.size === 0 ? buffer.length : Math.max(0, buffer.length - keep)
        emit(controller, buffer.slice(0, end))
        buffer = buffer.slice(end)
        return
      }
      const end = found.index + found.marker.length
      emit(controller, buffer.slice(0, end))
      buffer = buffer.slice(end)
      current = pending.get(found.marker)!
      pending.delete(found.marker)
      afterMarker = true
    }
  }

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true })
        consume(controller, false)
      },
      flush(controller) {
        buffer += decoder.decode()
        consume(controller, true)
        // A truncated document: pass the unfinished object through untouched.
        emit(controller, buffer)
      },
    }),
  )
}

// JSON.stringify happily emits `<`, which would end the inline <script> early.
// YouTube itself escapes these, so mirror that.
export function escapeForScriptTag(json: string) {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}
