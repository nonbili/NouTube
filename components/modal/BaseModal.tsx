import { clsx, isIos, isWeb } from '@/lib/utils'
import { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export const BaseModal: React.FC<{
  className?: string
  children: ReactNode
  onClose: () => void
  onRequestClose?: () => void
  useNativeModal?: boolean
}> = ({
  className,
  children,
  onClose,
  onRequestClose,
  useNativeModal = !isWeb,
}) => {
  const inner = isWeb ? children : <SafeAreaView className="flex-1 max-h-full" edges={['top', 'bottom']}>{children}</SafeAreaView>

  if (!isWeb && useNativeModal) {
    return (
      <Modal transparent visible onRequestClose={onRequestClose || onClose}>
        <View className="flex-1">
          <Pressable className="absolute inset-0 bg-zinc-300/50 dark:bg-gray-600/50" onPress={onClose} />
          <KeyboardAvoidingView
            behavior={isIos ? 'padding' : undefined}
            className="bg-zinc-100 dark:bg-gray-950 absolute top-0 left-0 bottom-0 w-[30rem] max-w-[80vw] flex-1"
          >
            {inner}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    )
  }

  return (
    <View className={clsx('absolute inset-0 z-10', className)}>
      <Pressable className="absolute inset-0 bg-zinc-300/50 dark:bg-gray-600/50" onPress={onClose} />
      <KeyboardAvoidingView
        behavior={isIos ? 'padding' : undefined}
        className="bg-zinc-100 dark:bg-gray-950 absolute top-0 left-0 bottom-0 w-[30rem] max-w-[80vw] flex-1"
      >
        {inner}
      </KeyboardAvoidingView>
    </View>
  )
}
