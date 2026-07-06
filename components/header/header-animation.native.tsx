import { useEffect } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

export function useHeaderAnimation({
  autoHideHeader,
  doubleTapToToggleHeader,
  headerHeight,
  headerPosition,
  headerShown,
  hideToolbarWhenScrolled,
  isHorizontal,
}: {
  autoHideHeader: boolean
  doubleTapToToggleHeader: boolean
  headerHeight: number
  headerPosition: 'top' | 'bottom'
  headerShown: boolean
  hideToolbarWhenScrolled: boolean
  isHorizontal: boolean
}) {
  const translateY = useSharedValue(0)

  useEffect(() => {
    const canHide = autoHideHeader || hideToolbarWhenScrolled || doubleTapToToggleHeader
    const shouldHide = (!isHorizontal || doubleTapToToggleHeader) && canHide && !headerShown
    const hiddenOffset = headerPosition === 'bottom' ? headerHeight : -headerHeight
    const next = shouldHide ? hiddenOffset : 0
    translateY.value = withTiming(next)
  }, [
    headerShown,
    headerHeight,
    autoHideHeader,
    doubleTapToToggleHeader,
    hideToolbarWhenScrolled,
    headerPosition,
    isHorizontal,
    translateY,
  ])

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
