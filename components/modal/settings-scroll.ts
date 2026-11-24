import { createContext, useContext, useMemo, useRef } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'

/** Lets content of the settings page scroll it, e.g. while dragging a row past its edge. */
export type SettingsScroller = {
  /** The scroll view's top and bottom in window coordinates; call it before scrolling with scrollBy. */
  measure: (callback: (top: number, bottom: number) => void) => void
  /** Scrolls by up to `delta` within the content and returns how far it actually moved. */
  scrollBy: (delta: number) => number
}

export const SettingsScrollContext = createContext<SettingsScroller | null>(null)

export const useSettingsScroller = () => useContext(SettingsScrollContext)

/** Props for the settings ScrollView, and the scroller to provide for its content. */
export const useSettingsScrollView = () => {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const offset = useRef(0)
  // Where scrollBy last asked to be: scroll events lag behind, so they must not move it mid-drag.
  const requested = useRef(0)
  const viewHeight = useRef(0)
  const contentHeight = useRef(0)

  const scroller = useMemo<SettingsScroller>(
    () => ({
      measure: (callback) => {
        requested.current = offset.current
        ref.current?.measureInWindow((_x, y, _width, height) => callback(y, y + height))
      },
      scrollBy: (delta) => {
        const max = Math.max(0, contentHeight.current - viewHeight.current)
        const next = Math.min(Math.max(0, requested.current + delta), max)
        const moved = next - requested.current
        if (moved !== 0) {
          requested.current = next
          ref.current?.scrollTo({ y: next, animated: false })
        }
        return moved
      },
    }),
    [],
  )

  const scrollViewProps = {
    ref,
    scrollEventThrottle: 16,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y
    },
    onLayout: (event: LayoutChangeEvent) => {
      viewHeight.current = event.nativeEvent.layout.height
    },
    onContentSizeChange: (_width: number, height: number) => {
      contentHeight.current = height
    },
  }

  return { scroller, scrollViewProps }
}
