import { Text, type TextProps } from 'react-native'
import { clsx } from '@/lib/utils'

export const NouText: React.FC<TextProps> = ({ className, ...rest }) => (
  <Text className={clsx('text-zinc-900 dark:text-gray-100', className)} {...rest} />
)
