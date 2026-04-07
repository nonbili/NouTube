import { clsx, isIos, isWeb } from '@/lib/utils'
import { ReactNode, useEffect, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, View } from 'react-native'
import { useModal } from '@/lib/hooks/useModal'

export const BaseCenterModal: React.FC<{
  className?: string
  containerClassName?: string
  children: ReactNode
  onClose: () => void
  useEscape?: boolean
}> = ({ className, containerClassName, children, onClose, useEscape = true }) => {
  useModal(onClose, useEscape)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  useEffect(() => {
    if (isWeb) {
      return
    }

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const handleBackdropPress = () => {
    if (!isWeb && keyboardVisible) {
      Keyboard.dismiss()
      return
    }
    onClose()
  }

  const innerCls = clsx(
    'rounded-lg bg-zinc-100 dark:bg-gray-950 w-[30rem] lg:w-[40rem] xl:w-[50rem] max-w-[80vw]',
    containerClassName,
  )

  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View className={clsx('flex-1 items-center justify-center', className)}>
        <Pressable className="absolute inset-0 bg-zinc-300/80 dark:bg-gray-600/80" onPress={handleBackdropPress} />
        <KeyboardAvoidingView behavior={isIos ? 'padding' : 'height'} pointerEvents="box-none">
          <View className={innerCls}>{children}</View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
