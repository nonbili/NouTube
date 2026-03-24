import { clsx, isIos, isWeb } from '@/lib/utils'
import { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native'
import { useModal } from '@/lib/hooks/useModal'

export const BaseCenterModal: React.FC<{
  className?: string
  containerClassName?: string
  children: ReactNode
  onClose: () => void
}> = ({ className, containerClassName, children, onClose }) => {
  useModal(onClose)

  const innerCls = clsx('rounded-lg bg-gray-950 w-[30rem] lg:w-[40rem] xl:w-[50rem] max-w-[80vw]', containerClassName)

  if (!isWeb) {
    return (
      <Modal transparent visible onRequestClose={onClose}>
        <View className="flex-1 items-center justify-center">
          <Pressable className="absolute inset-0 bg-gray-600/80" onPress={onClose} />
          <KeyboardAvoidingView behavior={isIos ? 'padding' : undefined} pointerEvents="box-none">
            <View className={innerCls}>{children}</View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    )
  }

  return (
    <View className={clsx('absolute inset-0 z-10 items-center justify-center', className)}>
      <Pressable className="absolute inset-0 bg-gray-600/80" onPress={onClose} />
      <KeyboardAvoidingView behavior={isIos ? 'padding' : undefined} pointerEvents="box-none">
        <View className={innerCls}>{children}</View>
      </KeyboardAvoidingView>
    </View>
  )
}
