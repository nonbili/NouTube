import { useEffect } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

export function useHeaderAnimation({
  autoHideHeader,
  doubleTapToToggleHeader,
  headerHeight,
  headerPosition,
  headerShown,
  hideToolbarWhenScrolled,
  isSidebarLayout,
}: {
  autoHideHeader: boolean
  doubleTapToToggleHeader: boolean
  headerHeight: number
  headerPosition: 'top' | 'bottom'
  headerShown: boolean
  hideToolbarWhenScrolled: boolean
  isSidebarLayout: boolean
}) {
  const translateY = useSharedValue(0)

  useEffect(() => {
    const canHide = autoHideHeader || hideToolbarWhenScrolled || doubleTapToToggleHeader
    // The toolbar only stops sliding away when it is the desktop vertical
    // sidebar; a landscape phone still gets a horizontal bar that should hide.
    const shouldHide = (!isSidebarLayout || doubleTapToToggleHeader) && canHide && !headerShown
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
    isSidebarLayout,
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
