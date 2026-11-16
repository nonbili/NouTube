import { useEffect, useRef } from 'react'

// Open modals, innermost last: Escape closes only the top one, so a modal
// opened over another (a bookmark over the library) doesn't take both down.
const stack: { current: () => void }[] = []

const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    stack.at(-1)?.current()
  }
}

export const useModal = (onClose: () => void, enabled = true) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!enabled || !window.addEventListener) {
      return
    }
    const entry = onCloseRef
    stack.push(entry)
    if (stack.length === 1) {
      window.addEventListener('keyup', onKeyUp)
    }
    return () => {
      stack.splice(stack.indexOf(entry), 1)
      if (stack.length === 0) {
        window.removeEventListener('keyup', onKeyUp)
      }
    }
  }, [enabled])
}
