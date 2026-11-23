import { observable } from '@legendapp/state'
import { useValue } from '@legendapp/state/react'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { useEffect, useRef, useState, type ComponentProps, type RefObject } from 'react'
import { Animated, PanResponder, useColorScheme, View } from 'react-native'
import { settings$ } from '@/states/settings'
import { getDropSlot, pinMenuItem, slotToPinIndex, unpinMenuItem, type PinnableMenuItemId } from '@/lib/toolbar-pins'

// Long-press drag of overflow menu entries onto the toolbar and of pinned
// toolbar icons back out of it (Android). Every position here is in window
// coordinates, so the menu Modal and the main window share one frame.

export type ViewRef = React.ComponentRef<typeof View>
type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }
type IconName = ComponentProps<typeof MaterialIcons>['name']

export type DragSource = 'menu' | 'toolbar'

const LONG_PRESS_MS = 400
const TOUCH_SLOP = 8
const GHOST_SIZE = 52
// Extra room around the toolbar that still counts as dropping on it.
const DROP_MARGIN = 16

export const toolbarDrag$ = observable({
  id: null as PinnableMenuItemId | null,
  icon: 'more-horiz' as IconName,
  source: 'menu' as DragSource,
  // Index of the dragged icon in the pinned row, -1 when it comes from the menu.
  fromIndex: -1,
  overToolbar: false,
  slot: 0,
  header: null as Rect | null,
  pins: null as (Rect & { slot: number }) | null,
})

const dragPosition = new Animated.ValueXY({ x: 0, y: 0 })

let headerRef: RefObject<ViewRef | null> | null = null
let pinsRef: RefObject<ViewRef | null> | null = null
let pinSlotWidth = 48

/** The toolbar and the row pinned icons sit in (pins first, then the menu button). */
export const registerToolbar = (
  header: RefObject<ViewRef | null>,
  pins: RefObject<ViewRef | null>,
  slotWidth: number,
) => {
  headerRef = header
  pinsRef = pins
  pinSlotWidth = slotWidth
}

const measureToolbar = () => {
  headerRef?.current?.measureInWindow((x, y, width, height) => {
    toolbarDrag$.header.set({ x, y, width, height })
  })
  pinsRef?.current?.measureInWindow((x, y, width, height) => {
    toolbarDrag$.pins.set({ x, y, width, height, slot: pinSlotWidth })
  })
}

const isOverToolbar = ({ x, y }: Point) => {
  const header = toolbarDrag$.header.peek()
  return Boolean(
    header &&
    x >= header.x - DROP_MARGIN &&
    x <= header.x + header.width + DROP_MARGIN &&
    y >= header.y - DROP_MARGIN &&
    y <= header.y + header.height + DROP_MARGIN,
  )
}

const getSlot = ({ x }: Point) => {
  const pins = toolbarDrag$.pins.peek()
  const count = settings$.pinnedMenuItems.peek().length
  return pins ? getDropSlot(x, pins.x, pins.slot, count) : count
}

export const startToolbarDrag = (
  item: { id: PinnableMenuItemId; icon: IconName; source: DragSource; fromIndex?: number },
  point: Point,
) => {
  measureToolbar()
  dragPosition.setValue(point)
  toolbarDrag$.assign({
    id: item.id,
    icon: item.icon,
    source: item.source,
    fromIndex: item.fromIndex ?? -1,
    overToolbar: isOverToolbar(point),
    slot: getSlot(point),
  })
}

export const moveToolbarDrag = (point: Point) => {
  dragPosition.setValue(point)
  const overToolbar = isOverToolbar(point)
  const slot = getSlot(point)
  if (overToolbar !== toolbarDrag$.overToolbar.peek()) {
    toolbarDrag$.overToolbar.set(overToolbar)
  }
  if (slot !== toolbarDrag$.slot.peek()) {
    toolbarDrag$.slot.set(slot)
  }
}

/** Applies the drop and says what happened; `null` point means the gesture was cancelled. */
export const endToolbarDrag = (point: Point | null): 'pinned' | 'unpinned' | 'cancelled' => {
  const { id, source, fromIndex } = toolbarDrag$.peek()
  toolbarDrag$.id.set(null)
  if (!id || !point) {
    return 'cancelled'
  }
  const pinned = settings$.pinnedMenuItems.peek()
  if (isOverToolbar(point)) {
    settings$.pinnedMenuItems.set(pinMenuItem(pinned, id, slotToPinIndex(getSlot(point), fromIndex)))
    return 'pinned'
  }
  if (source === 'toolbar') {
    settings$.pinnedMenuItems.set(unpinMenuItem(pinned, id))
    return 'unpinned'
  }
  return 'cancelled'
}

type LongPressDragHandlers = {
  onTap?: () => void
  onDragStart: (point: Point) => void
  onDragMove: (point: Point) => void
  onDragEnd: (point: Point | null) => void
}

const createLongPressResponder = (
  initialHandlers: LongPressDragHandlers,
  setPressed: (pressed: boolean) => void,
  setDragging: (dragging: boolean) => void,
) => {
  let view: ViewRef | null = null
  let handlers = initialHandlers
  let timer: ReturnType<typeof setTimeout> | undefined
  let dragging = false
  let moved = false
  let offset: Point = { x: 0, y: 0 }
  let last: Point = { x: 0, y: 0 }

  const toWindow = (page: Point) => ({ x: page.x - offset.x, y: page.y - offset.y })

  const reset = () => {
    clearTimeout(timer)
    dragging = false
    setPressed(false)
    setDragging(false)
  }

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => !dragging,
    onPanResponderGrant: (event) => {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent
      moved = false
      dragging = false
      last = { x: pageX, y: pageY }
      offset = { x: 0, y: 0 }
      setPressed(true)
      // Page coordinates are relative to the touched root view (a Modal has
      // its own); this offset maps them onto window coordinates.
      view?.measureInWindow((x, y) => {
        offset = { x: pageX - (x + locationX), y: pageY - (y + locationY) }
      })
      clearTimeout(timer)
      timer = setTimeout(() => {
        dragging = true
        setPressed(false)
        setDragging(true)
        handlers.onDragStart(toWindow(last))
      }, LONG_PRESS_MS)
    },
    onPanResponderMove: (_event, gesture) => {
      last = { x: gesture.moveX, y: gesture.moveY }
      if (dragging) {
        handlers.onDragMove(toWindow(last))
      } else if (!moved && (Math.abs(gesture.dx) > TOUCH_SLOP || Math.abs(gesture.dy) > TOUCH_SLOP)) {
        moved = true
        clearTimeout(timer)
        setPressed(false)
      }
    },
    onPanResponderRelease: () => {
      const wasDragging = dragging
      const tapped = !moved && !wasDragging
      reset()
      if (wasDragging) {
        handlers.onDragEnd(toWindow(last))
      } else if (tapped) {
        handlers.onTap?.()
      }
    },
    onPanResponderTerminate: () => {
      const wasDragging = dragging
      reset()
      if (wasDragging) {
        handlers.onDragEnd(null)
      }
    },
  })

  return {
    panHandlers: responder.panHandlers,
    setView: (next: ViewRef | null) => {
      view = next
    },
    setHandlers: (next: LongPressDragHandlers) => {
      handlers = next
    },
    dispose: () => clearTimeout(timer),
  }
}

/**
 * Tap, or long-press then drag, on one view. Coordinates handed to the
 * callbacks are in window space whatever root view the touch lands in.
 */
export const useLongPressDrag = (handlers: LongPressDragHandlers) => {
  const [pressed, setPressed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [responder] = useState(() => createLongPressResponder(handlers, setPressed, setDragging))
  useEffect(() => responder.setHandlers(handlers))
  useEffect(() => responder.dispose, [responder])

  // `ref` must go on the view that receives `panHandlers`.
  return { ref: responder.setView, panHandlers: responder.panHandlers, pressed, dragging }
}

/**
 * The icon under the finger, the toolbar drop target and the insertion mark.
 * Mount one per window a drag can start in: inside the menu Modal for menu
 * entries, over the page for pinned toolbar icons.
 */
export const ToolbarDropOverlay: React.FC<{ source: DragSource }> = ({ source }) => {
  const id = useValue(toolbarDrag$.id)
  const activeSource = useValue(toolbarDrag$.source)
  const icon = useValue(toolbarDrag$.icon)
  const overToolbar = useValue(toolbarDrag$.overToolbar)
  const slot = useValue(toolbarDrag$.slot)
  const fromIndex = useValue(toolbarDrag$.fromIndex)
  const header = useValue(toolbarDrag$.header)
  const pins = useValue(toolbarDrag$.pins)
  const isDark = useColorScheme() !== 'light'
  const rootRef = useRef<ViewRef>(null)
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 })
  const active = id !== null && activeSource === source
  const removing = active && source === 'toolbar' && !overToolbar
  // No mark where the dragged icon already sits: dropping there changes nothing.
  const showSlot = overToolbar && pins && !(fromIndex >= 0 && (slot === fromIndex || slot === fromIndex + 1))

  return (
    <View
      ref={rootRef}
      pointerEvents="none"
      collapsable={false}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }}
      onLayout={() => rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
    >
      {active && header ? (
        <View
          style={{
            position: 'absolute',
            left: header.x - origin.x,
            top: header.y - origin.y,
            width: header.width,
            height: header.height,
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: overToolbar ? '#6366f1' : isDark ? '#52525b' : '#a1a1aa',
            backgroundColor: overToolbar ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
          }}
        />
      ) : null}
      {active && showSlot && pins ? (
        <View
          style={{
            position: 'absolute',
            left: pins.x - origin.x + slot * pins.slot - (pins.slot - 44) / 2 - 1.5,
            top: pins.y - origin.y + 6,
            width: 3,
            height: Math.max(0, pins.height - 12),
            borderRadius: 2,
            backgroundColor: '#6366f1',
          }}
        />
      ) : null}
      {active ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: -origin.x - GHOST_SIZE / 2,
            top: -origin.y - GHOST_SIZE / 2,
            width: GHOST_SIZE,
            height: GHOST_SIZE,
            borderRadius: GHOST_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: removing ? '#dc2626' : isDark ? '#3f3f46' : '#ffffff',
            transform: dragPosition.getTranslateTransform(),
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 12,
          }}
        >
          <MaterialIcons
            name={removing ? 'close' : icon}
            size={26}
            color={removing ? '#ffffff' : isDark ? '#f4f4f5' : '#18181b'}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}
