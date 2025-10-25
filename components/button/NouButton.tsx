import { clsx, nIf } from '@/lib/utils'
import { NouText } from '../NouText'
import { ActivityIndicator, TouchableOpacity } from 'react-native'

export const NouButton = ({
  className,
  variant = 'solid',
  size = '2',
  loading = false,
  children,
  onPress,
}: React.PropsWithChildren<{
  className?: string
  variant?: 'solid' | 'soft' | 'outline'
  size?: '1' | '2'
  loading?: boolean
  onPress: () => void
}>) => {
  return (
    <TouchableOpacity
      className={clsx(
        'flex-row gap-2 text-center rounded-full',
        size == '1' && 'py-1 px-3',
        size == '2' && 'py-2 px-6',
        variant == 'solid' && 'bg-indigo-600',
        variant == 'soft' && 'bg-indigo-200',
        variant == 'outline' && 'border border-indigo-200',
        className,
      )}
      onPress={onPress}
    >
      {nIf(loading, <ActivityIndicator color="white" />)}
      <NouText className={clsx(variant == 'soft' && 'text-indigo-600')}>{children}</NouText>
    </TouchableOpacity>
  )
}
