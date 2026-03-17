import { colors } from '@/lib/colors'
import type { Item } from './NouMenu'
import { ReactNode, useRef, useState } from 'react'
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NouText } from '../NouText'
import { MaterialButton } from '../button/IconButtons'

export const NouMenu: React.FC<{ trigger: ReactNode; items: Item[] }> = ({ trigger, items }) => {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const triggerRef = useRef<View>(null)
  const menuWidth = 220
  const itemHeight = 44
  const menuHeight = items.length * itemHeight + 16

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
        {typeof trigger === 'string' ? <MaterialButton name="more-vert" onPress={openMenu} /> : <View onTouchEnd={openMenu}>{trigger}</View>}
      </View>
      <Modal transparent visible={open} animationType="fade" onRequestClose={closeMenu}>
        <View className="flex-1" pointerEvents="box-none">
          <Pressable className="absolute inset-0" onPress={closeMenu} />
          <View
            className="absolute rounded-xl py-2"
            style={{
              top,
              left,
              width: menuWidth,
              backgroundColor: colors.bg,
            }}
          >
            {items.map((item, index) => (
              <Pressable
                key={index}
                className="px-4 justify-center"
                style={{ minHeight: itemHeight }}
                android_ripple={{ color: colors.underlay }}
                onPress={() => {
                  closeMenu()
                  item.handler()
                }}
              >
                <NouText>{item.label}</NouText>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  )
}
