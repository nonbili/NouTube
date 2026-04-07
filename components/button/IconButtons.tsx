import { colors } from '@/lib/colors'
import AntDesign from '@expo/vector-icons/AntDesign'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ComponentProps } from 'react'
import { useColorScheme } from 'react-native'

export const AntButton = (props: ComponentProps<typeof AntDesign.Button>) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <AntDesign.Button
      color={isDark ? colors.icon : colors.iconLightStrong}
      backgroundColor="transparent"
      underlayColor={isDark ? colors.underlay : '#cbd5e1'}
      iconStyle={{ marginRight: 0 }}
      style={{ padding: 10 }}
      size={24}
      {...props}
    />
  )
}

export const MaterialButton = (props: ComponentProps<typeof MaterialIcons.Button>) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <MaterialIcons.Button
      color={isDark ? colors.icon : colors.iconLightStrong}
      backgroundColor="transparent"
      underlayColor={isDark ? colors.underlay : '#cbd5e1'}
      iconStyle={{ marginRight: 0 }}
      style={{ padding: 10 }}
      size={24}
      {...props}
    />
  )
}

export const MaterialCommunityButton = (props: ComponentProps<typeof MaterialCommunityIcons.Button>) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <MaterialCommunityIcons.Button
      color={isDark ? colors.icon : colors.iconLightStrong}
      backgroundColor="transparent"
      underlayColor={isDark ? colors.underlay : '#cbd5e1'}
      iconStyle={{ marginRight: 0 }}
      style={{ padding: 10 }}
      size={24}
      {...props}
    />
  )
}
