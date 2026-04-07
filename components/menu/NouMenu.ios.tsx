import { colors } from '@/lib/colors'
import { Button, ContextMenu, Divider, Host, Section } from '@expo/ui/swift-ui'
import { frame } from '@expo/ui/swift-ui/modifiers'
import type { Item } from './NouMenu'
import { cloneElement, Fragment, isValidElement, ReactNode } from 'react'
import { useColorScheme } from 'react-native'

export const NouMenu: React.FC<{ trigger: ReactNode; items: Item[]; triggerColor?: string }> = ({ trigger, items, triggerColor }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const resolvedTriggerColor = triggerColor ?? (isDark ? colors.icon : colors.iconLight)
  const groups = items.reduce<Item[][]>((acc, item) => {
    if (item.kind === 'separator') {
      acc.push([])
      return acc
    }

    const current = acc[acc.length - 1]
    current.push(item)
    return acc
  }, [[]]).filter((group) => group.length)

  const menuItems = groups.map((group, groupIndex) => {
    const header = group.find((item) => item.kind === 'label')
    const buttons = group
      .filter((item) => item.kind !== 'label')
      .map((item, itemIndex) => (
        <Button
          key={`${groupIndex}-${itemIndex}`}
          disabled={item.disabled}
          onPress={item.handler}
          systemImage={item.systemImage as never}
        >
          {item.metaLabel ? `${item.label} (${item.metaLabel})` : item.label}
        </Button>
      ))

    const content = header ? (
      <Section key={`section-${groupIndex}`} title={header.label}>
        {buttons}
      </Section>
    ) : (
      buttons
    )

    return (
      <Fragment key={`group-${groupIndex}`}>
        {groupIndex > 0 ? <Divider key={`divider-${groupIndex}`} /> : null}
        {content}
      </Fragment>
    )
  })

  return (
    <Host matchContents>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Items>{menuItems}</ContextMenu.Items>
        <ContextMenu.Trigger>
          {typeof trigger === 'string' ? (
            <Button
              variant="borderless"
              color={resolvedTriggerColor}
              systemImage={trigger as never}
              modifiers={[frame({ width: 44, height: 44 })]}
            />
          ) : (
            isValidElement(trigger) ? cloneElement(trigger as React.ReactElement<any>, { color: resolvedTriggerColor }) : trigger
          )}
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  )
}
