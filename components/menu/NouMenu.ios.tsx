import { colors } from '@/lib/colors'
import { Button, Divider, Host, Menu, Section } from '@expo/ui/swift-ui'
import { buttonStyle, disabled, frame, tint } from '@expo/ui/swift-ui/modifiers'
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
          onPress={item.handler}
          systemImage={item.systemImage as never}
          label={item.metaLabel ? `${item.label} (${item.metaLabel})` : item.label}
          modifiers={item.disabled ? [disabled(true)] : undefined}
        />
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
      <Menu
        label={
          typeof trigger === 'string'
            ? ''
            : isValidElement(trigger)
              ? cloneElement(trigger as React.ReactElement<any>, { color: resolvedTriggerColor })
              : trigger
        }
        systemImage={typeof trigger === 'string' ? trigger : undefined}
        modifiers={
          typeof trigger === 'string'
            ? [buttonStyle('borderless'), tint(resolvedTriggerColor), frame({ width: 44, height: 44 })]
            : undefined
        }
      >
        {menuItems}
      </Menu>
    </Host>
  )
}
