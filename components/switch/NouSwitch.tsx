import { Platform, Pressable, Switch, View } from 'react-native'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import { useTwColor } from '@/lib/theme'

export const NouSwitch: React.FC<{ className?: string; label: string; value: boolean; onPress: () => void }> = ({
  className,
  label,
  value,
  onPress,
}) => {
  const tw = useTwColor()
  return (
    <View className={clsx('items-center flex-row justify-between', className)}>
      <Pressable className="flex-1" onPress={onPress}>
        <NouText className="font-medium">{label}</NouText>
      </Pressable>
      <Switch
        value={value}
        onValueChange={(v) => onPress()}
        trackColor={{ false: '#767577', true: tw('indigo-200') }}
        thumbColor={value ? tw('indigo-500') : '#f4f3f4'}
        {...Platform.select({
          web: {
            activeThumbColor: tw('indigo-500'),
          },
        })}
      />
    </View>
  )
}
