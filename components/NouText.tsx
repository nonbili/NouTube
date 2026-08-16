import { Text, type TextProps } from 'react-native'
import { resolveTextClass } from '@/lib/text-class'

export const NouText: React.FC<TextProps> = ({ className, ...rest }) => (
  <Text className={resolveTextClass('text-zinc-900', 'dark:text-gray-100', className)} {...rest} />
)
