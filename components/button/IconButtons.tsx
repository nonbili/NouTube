import { colors } from '@/lib/colors'
import AntDesign from '@react-native-vector-icons/ant-design'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons'
import { type ComponentProps, type ElementType } from 'react'
import { Pressable, useColorScheme } from 'react-native'
import { useTwColor } from '@/lib/theme'

type IconButtonProps<T extends ElementType> = Omit<ComponentProps<T>, 'style' | 'onPress'> & Omit<ComponentProps<typeof Pressable>, 'children'>

export const AntButton = ({ color, name, size = 24, style, ...props }: IconButtonProps<typeof AntDesign>) => {
  const tw = useTwColor()
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <Pressable
      className="h-11 w-11 items-center justify-center"
      style={(state) => (typeof style === 'function' ? style(state) : style)}
      {...props}
    >
      <AntDesign name={name} size={size} color={color ?? (isDark ? tw(colors.icon) : tw(colors.iconLightStrong))} />
    </Pressable>
  )
}

export const MaterialButton = ({ color, name, size = 24, style, ...props }: IconButtonProps<typeof MaterialIcons>) => {
  const tw = useTwColor()
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <Pressable
      className="h-11 w-11 items-center justify-center"
      style={(state) => (typeof style === 'function' ? style(state) : style)}
      {...props}
    >
      <MaterialIcons name={name} size={size} color={color ?? (isDark ? tw(colors.icon) : tw(colors.iconLightStrong))} />
    </Pressable>
  )
}

export const MaterialCommunityButton = ({ color, name, size = 24, style, ...props }: IconButtonProps<typeof MaterialCommunityIcons>) => {
  const tw = useTwColor()
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <Pressable
      className="h-11 w-11 items-center justify-center"
      style={(state) => (typeof style === 'function' ? style(state) : style)}
      {...props}
    >
      <MaterialCommunityIcons name={name} size={size} color={color ?? (isDark ? tw(colors.icon) : tw(colors.iconLightStrong))} />
    </Pressable>
  )
}
