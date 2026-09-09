import { useValue } from '@legendapp/state/react'
import { Pressable, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NouText } from './NouText'
import { getToastColors } from '@/lib/toast-theme'
import { dismissToast, toasts$ } from '@/states/toast'

// Only iOS fills toasts$ (see lib/toast.ios.ts); elsewhere this renders
// nothing and the platform's own toast is used instead.
export const Toast = () => {
  const toasts = useValue(toasts$)
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const toastColors = getToastColors(colorScheme !== 'light')

  if (!toasts.length) {
    return null
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0 z-[1000] items-center justify-end px-4"
      style={{ paddingBottom: Math.max(insets.bottom, 16) }}
    >
      <View pointerEvents="box-none" className="w-full max-w-[420px] gap-2">
        {toasts.map((toast) => (
          <Pressable
            key={toast.id}
            accessibilityLiveRegion="polite"
            onPress={() => dismissToast(toast.id)}
            className="rounded-xl px-4 py-3 shadow-xl"
            style={{ backgroundColor: toastColors.background }}
          >
            <NouText style={{ color: toastColors.text }} numberOfLines={3}>
              {toast.message}
            </NouText>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
