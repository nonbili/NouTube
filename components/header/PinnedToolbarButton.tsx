import MaterialIcons from '@react-native-vector-icons/material-icons'
import { type ComponentProps } from 'react'
import { useColorScheme, View } from 'react-native'
import type { PinnableMenuItemId } from '@/lib/toolbar-pins'
import { endToolbarDrag, moveToolbarDrag, startToolbarDrag, useLongPressDrag } from './toolbar-drag'

type IconName = ComponentProps<typeof MaterialIcons>['name']

/** An overflow menu entry pinned to the toolbar: tap runs it, long press drags it to reorder or unpin. */
export const PinnedToolbarButton: React.FC<{
  id: PinnableMenuItemId
  index: number
  icon: string
  label: string
  color: string
  onPress: () => void
}> = ({ id, index, icon, label, color, onPress }) => {
  const isDark = useColorScheme() !== 'light'
  const { ref, panHandlers, pressed, dragging } = useLongPressDrag({
    onTap: onPress,
    onDragStart: (point) =>
      startToolbarDrag({ id, icon: icon as IconName, source: 'toolbar', fromIndex: index }, point),
    onDragMove: moveToolbarDrag,
    onDragEnd: endToolbarDrag,
  })

  return (
    <View
      ref={ref}
      collapsable={false}
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{
        opacity: dragging ? 0.3 : 1,
        backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : undefined,
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => event.nativeEvent.actionName === 'activate' && onPress()}
      testID={`header-pinned-${id}`}
      {...panHandlers}
    >
      <MaterialIcons name={icon as IconName} size={24} color={color} />
    </View>
  )
}
