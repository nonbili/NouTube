import { type ComponentProps, type ReactNode } from 'react'
import { Modal, Pressable, View, useColorScheme } from 'react-native'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { NouText } from '../NouText'
import { useKeyboardHeight } from '@/lib/hooks/useKeyboardHeight'
import { useModal } from '@/lib/hooks/useModal'

/*
 * A page, not a card: editors that own the whole screen (code, long forms) get
 * a fixed header with their actions, so Save never scrolls out of reach and the
 * body below can take every remaining pixel.
 *
 * The activity is windowSoftInputMode adjustResize, but a Modal lives in its own
 * window that Android does not resize, so the keyboard would cover the bottom of
 * the body — and with it the caret in a full height editor. Padding the body by
 * the keyboard height gives the flex-1 child the same effect a resize would.
 */
export const BaseFullScreenModal: React.FC<{
  title: string
  icon: ComponentProps<typeof MaterialIcons>['name']
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
}> = ({ title, icon, onClose, actions, children }) => {
  useModal(onClose)
  const isDark = useColorScheme() !== 'light'
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-zinc-100 dark:bg-zinc-950" edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-2 border-b border-zinc-300 dark:border-zinc-800 px-3 py-3">
          <Pressable
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-900"
          >
            <MaterialIcons name="arrow-back" color={isDark ? 'white' : '#111827'} size={22} />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2">
            <MaterialIcons name={icon} color="#818cf8" size={18} />
            <NouText className="text-lg font-semibold" numberOfLines={1}>
              {title}
            </NouText>
          </View>
          {actions}
        </View>
        <View className="flex-1" style={{ paddingBottom: Math.max(0, keyboardHeight - insets.bottom) }}>
          {children}
        </View>
      </SafeAreaView>
    </Modal>
  )
}
