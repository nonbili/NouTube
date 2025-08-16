import { colors } from '@/lib/colors'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { ComponentProps } from 'react'

type Props = ComponentProps<typeof MaterialIcons.Button>

export const MaterialButton = (props: Props) => (
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
