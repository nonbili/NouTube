import { ContextMenu } from '@radix-ui/themes'
import { ReactNode } from 'react'

export interface TabMenuItem {
  label: string
  handler: () => void
  color?: ContextMenu.ItemProps['color']
  icon?: ReactNode
}

export const TabContextMenu: React.FC<{ children: ReactNode; items: TabMenuItem[] }> = ({ children, items }) => {
  const hasAnyIcon = items.some((item) => Boolean(item.icon))

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
            <div className="flex min-w-0 flex-row items-center gap-3 leading-none">
              {item.icon ? (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</div>
              ) : hasAnyIcon ? (
                <div className="h-5 w-5 shrink-0" />
              ) : null}
              <div className="min-w-0 flex-1 truncate">{item.label}</div>
            </div>
          </ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu.Root>
  )
}
