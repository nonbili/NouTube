import { Button, DropdownMenu } from '@radix-ui/themes'
import { ReactNode } from 'react'

export interface Item {
  label: string
  handler: () => void
}

export const NouMenu: React.FC<{ trigger: ReactNode; items: Item[] }> = ({ trigger, items }) => {
  const menuItems = items.map((item, index) => (
    <DropdownMenu.Item key={index} onClick={item.handler}>
      {item.label}
    </DropdownMenu.Item>
  ))

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content variant="soft">{menuItems}</DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
