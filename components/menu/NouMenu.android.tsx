import { colors } from '@/lib/colors'
import { Button, ContextMenu } from '@expo/ui/jetpack-compose'
import type { Item } from './NouMenu'
import { ReactNode } from 'react'

export const NouMenu: React.FC<{ trigger: ReactNode; items: Item[] }> = ({ trigger, items }) => {
  const menuItems = items.map((item, index) => (
    <Button
      key={index}
      elementColors={{
        containerColor: colors.bg,
        contentColor: colors.text,
      }}
      onPress={item.handler}
    >
      {item.label}
    </Button>
  ))

  return (
    <ContextMenu color={colors.bg}>
      <ContextMenu.Items>{menuItems}</ContextMenu.Items>
      <ContextMenu.Trigger>
        <Button
          elementColors={{ containerColor: 'transparent', contentColor: colors.icon }}
          leadingIcon={trigger as any}
        >
          {''}
        </Button>
      </ContextMenu.Trigger>
    </ContextMenu>
  )
}
