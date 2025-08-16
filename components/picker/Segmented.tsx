import { View, Text, Pressable } from 'react-native'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'

export const Segemented: React.FC<{
  options: string[]
  selectedIndex: number
  size?: 1 | 2
  onChange: (index: number) => void
}> = ({ options, selectedIndex, size = 2, onChange }) => {
  return (
    <View className="flex-row">
      {options.map((tab, index) => {
        const active = index == selectedIndex
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(index)}
            className={clsx(
              size == 1 ? 'px-3 py-1' : 'px-4 py-2',
              active ? 'bg-zinc-100' : 'bg-zinc-700',
              index == 0 && 'rounded-l-md',
              index < options.length - 1 && 'border-r',
              index == options.length - 1 && 'rounded-r-md',
            )}
          >
            <NouText className={clsx('font-medium', size == 1 && 'text-sm', active && 'text-gray-900')}>{tab}</NouText>
          </Pressable>
        )
      })}
    </View>
  )
}
