import { ContextMenu } from '@radix-ui/themes'
import { ReactNode } from 'react'

export interface TabMenuItem {
  label: string
  handler: () => void
  color?: ContextMenu.ItemProps['color']
}

export const TabContextMenu: React.FC<{ children: ReactNode; items: TabMenuItem[] }> = ({ children, items }) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>{children}</ContextMenu.Trigger>
      <ContextMenu.Content
        variant="soft"
        className="rounded-xl border border-zinc-300/70 dark:border-zinc-800/80 shadow-xl shadow-zinc-900/15 dark:shadow-black/40"
      >
        {items.map((item, index) => (
          <ContextMenu.Item
            key={index}
            color={item.color}
            onClick={item.handler}
            className="min-w-[160px] px-3 py-2 text-[13px] leading-[20px]"
          >
            {item.label}
          </ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu.Root>
  )
}
