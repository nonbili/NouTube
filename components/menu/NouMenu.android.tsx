import { colors } from '@/lib/colors'
import type { Item } from './NouMenu'
import { cloneElement, isValidElement, ReactNode, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, useColorScheme, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NouText } from '../NouText'
import { MaterialButton } from '../button/IconButtons'

type Anchor = {
  x: number
  y: number
  width: number
  height: number
}

export const NouMenu: React.FC<{ trigger?: ReactNode; items: Item[]; triggerColor?: string }> = ({ items, trigger, triggerColor }) => {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const resolvedTriggerColor = triggerColor ?? (isDark ? colors.icon : colors.iconLight)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const triggerRef = useRef<View>(null)
  const menuWidth = 280
  const getRowHeight = (item: Item) => {
    if (item.kind === 'separator') return 9
    if (item.kind === 'label') return 32
    return item.description ? 56 : 44
  }
  const menuHeight = items.reduce((total, item) => total + getRowHeight(item), 16)

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height })
      setOpen(true)
    })
  }

  const closeMenu = () => setOpen(false)

  const horizontalPadding = 8
  const verticalPadding = 8
  const triggerGap = 4
  const minTop = insets.top + verticalPadding
  const maxTop = Math.max(minTop, screenHeight - insets.bottom - menuHeight - verticalPadding)
  const maxMenuHeight = Math.max(160, screenHeight - insets.top - insets.bottom - verticalPadding * 2)
  const top = anchor
    ? (() => {
        const belowTop = anchor.y + anchor.height + triggerGap
        const aboveTop = anchor.y + anchor.height - menuHeight - triggerGap
        const fitsBelow = belowTop <= maxTop
        const preferredTop = fitsBelow ? belowTop : aboveTop
        return Math.min(Math.max(preferredTop, minTop), maxTop)
      })()
    : minTop
  const left = anchor
    ? Math.min(
        Math.max(anchor.x + anchor.width - menuWidth, horizontalPadding),
        Math.max(horizontalPadding, screenWidth - menuWidth - horizontalPadding),
      )
    : horizontalPadding

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        {typeof trigger === 'string' ? (
          <MaterialButton name="more-vert" color={resolvedTriggerColor} onPress={openMenu} />
        ) : trigger ? (
          <Pressable onPress={openMenu}>
            <View>{isValidElement(trigger) ? cloneElement(trigger as React.ReactElement<any>, { color: resolvedTriggerColor }) : trigger}</View>
          </Pressable>
        ) : (
          <MaterialButton name="more-vert" color={resolvedTriggerColor} onPress={openMenu} />
        )}
      </View>
      <Modal transparent visible={open} animationType="fade" onRequestClose={closeMenu}>
        <View className="flex-1" pointerEvents="box-none">
          <Pressable className="absolute inset-0" onPress={closeMenu} />
          <View
            className="absolute rounded-xl py-2 border border-zinc-300 dark:border-zinc-700"
            style={{
              top,
              left,
              width: menuWidth,
              maxHeight: maxMenuHeight,
              backgroundColor: isDark ? colors.bg : '#f8fafc',
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.42 : 0.18,
              shadowRadius: isDark ? 18 : 14,
              shadowOffset: { width: 0, height: isDark ? 12 : 8 },
              elevation: isDark ? 20 : 12,
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.map((item, index) => {
                if (item.kind === 'separator') {
                  return <View key={index} className="mx-3 my-1 h-px bg-zinc-300 dark:bg-zinc-700" />
                }

                if (item.kind === 'label') {
                  return (
                    <View key={index} className="px-4 pt-2 pb-1">
                      <NouText className="text-[11px] uppercase tracking-[1px] text-zinc-600 dark:text-zinc-500">
                        {item.label}
                      </NouText>
                    </View>
                  )
                }

                return (
                  <Pressable
                    key={index}
                    className="px-4 flex-row items-center gap-3"
                    style={{ minHeight: getRowHeight(item) }}
                    android_ripple={{ color: isDark ? colors.underlay : '#e5e7eb' }}
                    disabled={item.disabled}
                    onPress={() => {
                      closeMenu()
                      item.handler()
                    }}
                  >
                    {item.icon ? <View className="shrink-0">{item.icon}</View> : null}
                    <View className="flex-1 min-w-0 py-2">
                      <NouText className="text-sm text-zinc-900 dark:text-zinc-100" numberOfLines={1}>
                        {item.label}
                      </NouText>
                      {item.description ? (
                        <NouText className="text-xs text-zinc-500" numberOfLines={1}>
                          {item.description}
                        </NouText>
                      ) : null}
                    </View>
                    {item.meta ? (
                      <View className="shrink-0">{item.meta}</View>
                    ) : item.metaLabel ? (
                      <NouText className="shrink-0 text-xs text-zinc-600 dark:text-zinc-500">{item.metaLabel}</NouText>
                    ) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}
