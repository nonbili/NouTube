import { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { getSnapshot, type AppSnapshot, type StateChangedMessage } from '../lib/messages'

/* The background owns the durable state; every surface reads it from here. */
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>()
  const [error, setError] = useState('')
  const sequence = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++sequence.current
    try {
      const next = await getSnapshot()
      if (current === sequence.current) {
        setSnapshot(next)
        setError('')
      }
    } catch (reason) {
      if (current === sequence.current) {
        setError(reason instanceof Error ? reason.message : String(reason))
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onMessage = (message: unknown) => {
      if ((message as StateChangedMessage | undefined)?.type === 'state-changed') {
        void refresh()
      }
    }
    browser.runtime.onMessage.addListener(onMessage)
    return () => {
      sequence.current += 1
      browser.runtime.onMessage.removeListener(onMessage)
    }
  }, [refresh])

  return { snapshot, error, refresh, setError }
}
