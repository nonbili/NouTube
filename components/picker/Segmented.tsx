import { View, Pressable } from 'react-native'
import { NouText } from '../NouText'
import { clsx, isIos } from '@/lib/utils'

export const Segmented: React.FC<{
  options: string[]
  selectedIndex: number
  size?: 1 | 2
  onChange: (index: number) => void
}> = ({ options, selectedIndex, size = 2, onChange }) => {
  return (
    <View className="flex-row rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-200/80 dark:bg-zinc-800/70 p-1">
      {options.map((tab, index) => {
        const active = index === selectedIndex
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(index)}
            className={clsx(
              size === 1 ? 'px-3 py-1.5' : 'px-4 py-2',
              active ? 'bg-zinc-50 dark:bg-zinc-700' : 'bg-transparent',
              !isIos && index === 0 && 'rounded-l-lg',
              !isIos && index === options.length - 1 && 'rounded-r-lg',
            )}
          >
            <NouText
              className={clsx(
                'font-medium text-zinc-600 dark:text-zinc-300',
                size === 1 && 'text-sm',
                active && 'text-zinc-900 dark:text-zinc-100',
              )}
            >
              {tab}
            </NouText>
          </Pressable>
        )
      })}
    </View>
  )
}
