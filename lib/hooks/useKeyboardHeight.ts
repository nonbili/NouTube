import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'

export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height))
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return keyboardHeight
}
