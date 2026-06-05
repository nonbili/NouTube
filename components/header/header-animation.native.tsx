import { useEffect } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

export function useHeaderAnimation({
  autoHideHeader,
  headerHeight,
  headerPosition,
  headerShown,
  hideToolbarWhenScrolled,
  isHorizontal,
}: {
  autoHideHeader: boolean
  headerHeight: number
  headerPosition: 'top' | 'bottom'
  headerShown: boolean
  hideToolbarWhenScrolled: boolean
  isHorizontal: boolean
}) {
  const translateY = useSharedValue(0)

  useEffect(() => {
    const shouldHide = !isHorizontal && (autoHideHeader || hideToolbarWhenScrolled) && !headerShown
    const hiddenOffset = headerPosition === 'bottom' ? headerHeight : -headerHeight
    const next = shouldHide ? hiddenOffset : 0
    translateY.value = withTiming(next)
  }, [headerShown, headerHeight, autoHideHeader, hideToolbarWhenScrolled, headerPosition, isHorizontal, translateY])

  const style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    }
  }, [translateY])

  return {
    Root: Animated.View,
    style,
  }
}
