import { useValue } from '@legendapp/state/react'
import { useEffect } from 'react'
import { AppState, Pressable, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { t } from 'i18next'
import { NouText } from './NouText'
import { getToastColors } from '@/lib/toast-theme'
import { pruneExpiredUndoToasts, runUndoAction, undoToasts$ } from '@/states/undo-toast'

export const UndoToast = () => {
  const toasts = useValue(undoToasts$)
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const toastColors = getToastColors(colorScheme !== 'light')

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        pruneExpiredUndoToasts()
      }
    })
    return () => subscription.remove()
  }, [])

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
          <View
            key={toast.id}
            accessibilityLiveRegion="polite"
            className="flex-row items-center rounded-xl px-4 py-3 shadow-xl"
            style={{ backgroundColor: toastColors.background }}
          >
            <NouText
              pointerEvents="none"
              className="min-w-0 flex-1"
              style={{ color: toastColors.text }}
              numberOfLines={2}
            >
              {toast.message}
            </NouText>
            <Pressable accessibilityRole="button" onPress={() => runUndoAction(toast.id)} className="ml-4 px-2 py-1">
              <NouText className="font-semibold" style={{ color: toastColors.accent }}>
                {t('buttons.undo')}
              </NouText>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  )
}
