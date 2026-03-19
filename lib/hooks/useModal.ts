import { useCallback, useEffect } from 'react'

export const useModal = (onClose: () => void, enabled = true) => {
  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (!window.addEventListener) {
      return
    }
    window.addEventListener('keyup', handleKeyUp)
    return () => window.removeEventListener('keyup', handleKeyUp)
  }, [enabled, handleKeyUp])
}
