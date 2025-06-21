import { StyleSheet, Text, type TextProps } from 'react-native'
import { use$ } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { clsx } from '@/lib/utils'

export const NouText: React.FC<TextProps> = ({ className, ...rest }) => (
  <Text className={clsx('text-gray-100', className)} {...rest} />
)
