import { colors } from '@/lib/colors'
import { DropdownMenu } from '@radix-ui/themes'
import { cloneElement, isValidElement, ReactNode } from 'react'
import { useColorScheme } from 'react-native'

export interface Item {
  label: string
  handler: () => void
  icon?: ReactNode
  systemImage?: string
  disabled?: boolean
  description?: string
  kind?: 'item' | 'label' | 'separator'
  meta?: ReactNode
  metaLabel?: string
}

export const NouMenu: React.FC<{ trigger: ReactNode; items: Item[]; triggerColor?: string }> = ({ trigger, items, triggerColor }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const resolvedTriggerColor = triggerColor ?? (isDark ? colors.icon : colors.iconLight)
  const renderedTrigger =
    isValidElement(trigger) ? cloneElement(trigger as React.ReactElement<any>, { color: resolvedTriggerColor }) : trigger

  const menuItems = items.map((item, index) => {
    if (item.kind === 'separator') {
      return <DropdownMenu.Separator key={index} />
    }

    if (item.kind === 'label') {
      return (
        <DropdownMenu.Label key={index} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
          {item.label}
        </DropdownMenu.Label>
      )
    }

    return (
      <DropdownMenu.Item
        key={index}
        onClick={item.handler}
        disabled={item.disabled}
        className="min-w-[160px] max-w-[320px] px-3 py-2"
      >
        <div className="flex min-w-0 flex-row items-center gap-3 leading-none">
          {item.icon ? (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              {item.icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] leading-[20px] text-zinc-900 dark:text-zinc-100">{item.label}</div>
            {item.description ? <div className="truncate text-xs text-zinc-600 dark:text-zinc-500">{item.description}</div> : null}
          </div>
          {item.meta ? <div className="shrink-0">{item.meta}</div> : item.metaLabel ? <div className="shrink-0 text-xs text-zinc-600 dark:text-zinc-500">{item.metaLabel}</div> : null}
        </div>
      </DropdownMenu.Item>
    )
  })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <div className="flex min-w-0 shrink items-center justify-center">{renderedTrigger}</div>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content variant="soft" className="max-h-[70vh] overflow-auto rounded-xl border border-zinc-300/70 dark:border-zinc-800/80 shadow-xl shadow-zinc-900/15 dark:shadow-black/40">
        {menuItems}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
