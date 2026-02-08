import { colors } from '@/lib/colors'
import { Button, ContextMenu, Host } from '@expo/ui/swift-ui'
import { frame } from '@expo/ui/swift-ui/modifiers'
import type { Item } from './NouMenu'
import { ReactNode } from 'react'

export const NouMenu: React.FC<{ trigger: ReactNode; items: Item[] }> = ({ trigger, items }) => {
  const menuItems = items.map((item, index) => (
    <Button key={index} color={colors.text} onPress={item.handler}>
      {item.label}
    </Button>
  ))

  return (
    <Host matchContents>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Items>{menuItems}</ContextMenu.Items>
        <ContextMenu.Trigger>
          <Button
            variant="borderless"
            color={colors.icon}
            systemImage={trigger as any}
            modifiers={[frame({ width: 44, height: 44 })]}
          />
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  )
}
