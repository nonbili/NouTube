import React from 'react'
import { View } from 'react-native'

export function WebviewContainer({
  children,
  headerPosition,
  nativeHeaderInset,
}: {
  children: React.ReactNode
  headerPosition: 'top' | 'bottom'
  nativeHeaderInset: number
}) {
  return (
    <View
      style={{
        flex: 1,
        marginTop: headerPosition === 'top' ? nativeHeaderInset : 0,
        marginBottom: headerPosition === 'bottom' ? nativeHeaderInset : 0,
      }}
    >
      {children}
    </View>
  )
}
