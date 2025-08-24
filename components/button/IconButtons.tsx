import { colors } from '@/lib/colors'
import AntDesign from '@expo/vector-icons/AntDesign'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { ComponentProps } from 'react'

export const AntButton = (props: ComponentProps<typeof AntDesign.Button>) => (
  <AntDesign.Button
    color={colors.icon}
    backgroundColor="transparent"
    underlayColor={colors.underlay}
    iconStyle={{ marginRight: 0 }}
    style={{ padding: 10 }}
    size={24}
    {...props}
  />
)

export const MaterialButton = (props: ComponentProps<typeof MaterialIcons.Button>) => (
  <MaterialIcons.Button
    color={colors.icon}
    backgroundColor="transparent"
    underlayColor={colors.underlay}
    iconStyle={{ marginRight: 0 }}
    style={{ padding: 10 }}
    size={24}
    {...props}
  />
)
