import React, { useEffect } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

export function WebviewContainer({
  children,
  headerPosition,
  nativeHeaderInset,
}: {
  children: React.ReactNode
  headerPosition: 'top' | 'bottom'
  nativeHeaderInset: number
}) {
  const animatedInset = useSharedValue(nativeHeaderInset)

  useEffect(() => {
    animatedInset.value = withTiming(nativeHeaderInset)
  }, [nativeHeaderInset, animatedInset])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      marginTop: headerPosition === 'top' ? animatedInset.value : 0,
      marginBottom: headerPosition === 'bottom' ? animatedInset.value : 0,
    }
  }, [headerPosition, animatedInset])

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      {children}
    </Animated.View>
  )
}
