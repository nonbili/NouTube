import { clsx, isWeb } from '@/lib/utils'
import { ReactNode } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

export const BaseCenterModal: React.FC<{ className?: string; children: ReactNode; onClose: () => void }> = ({
  className,
  children,
  onClose,
}) => {
  return (
    <View className={clsx('absolute inset-0 z-10 items-center justify-center', className)}>
      <Pressable className="absolute inset-0 bg-gray-600/50" onPress={onClose} />
      <View className="rounded-lg bg-gray-950 w-[30rem] lg:w-[40rem] xl:w-[50rem] max-w-[80vw]">{children}</View>
    </View>
  )
}
