import { clsx } from '@/lib/utils'
import { NouText } from '../NouText'
import { TouchableOpacity } from 'react-native'

export const NouButton = ({
  variant = 'solid',
  size = '2',
  children,
  onPress,
}: React.PropsWithChildren<{ variant?: 'solid' | 'soft' | 'outline'; size?: '1' | '2'; onPress: () => void }>) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <NouText
        className={clsx(
          'text-center rounded-full',
          size == '1' && 'py-1 px-3',
          size == '2' && 'py-2 px-6',
          variant == 'solid' && 'bg-indigo-600',
          variant == 'soft' && 'bg-indigo-200 text-indigo-600',
          variant == 'outline' && 'border border-indigo-200',
        )}
      >
        {children}
      </NouText>
    </TouchableOpacity>
  )
}
