import MaterialIcons, { type MaterialIconsIconName } from '@react-native-vector-icons/material-icons'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, Switch, useColorScheme, View } from 'react-native'
import { settings$ } from '@/states/settings'
import { getToolbarButtonLabel, isMenuToolbarButton, moveItem, type ToolbarButtonId } from '@/lib/toolbar-buttons'
import { useTwColor } from '@/lib/theme'
import { clsx } from '@/lib/utils'
import { NouText } from '../NouText'
import { useSettingsScroller, type SettingsScroller } from './settings-scroll'

const ROW_HEIGHT = 64
// Holding a row this close to the top or bottom of the page scrolls it.
const AUTO_SCROLL_EDGE = 72
const AUTO_SCROLL_STEP = 10
const TOUCH_SLOP = 8

const buttonIcon: Record<ToolbarButtonId, MaterialIconsIconName> = {
  library: 'video-library',
  feed: 'rss-feed',
  back: 'arrow-back',
  forward: 'arrow-forward',
  reload: 'refresh',
  home: 'home',
  history: 'history',
  'switch-home': 'library-music',
  'desktop-mode': 'desktop-windows',
  'open-url': 'link',
  share: 'share',
  tools: 'download',
  settings: 'settings',
  speed: 'speed',
  quality: 'high-quality',
  'sleep-timer': 'bedtime',
  queue: 'playlist-play',
  scripts: 'extension',
}

// Built-in and playback buttons keep their own settings; the feed button follows the feed feature.
const builtinSettingKey = {
  library: 'showLibraryButtonInHeader',
  feed: 'feedsEnabled',
  back: 'showBackButtonInHeader',
  forward: 'showForwardButtonInHeader',
  reload: 'showReloadButtonInHeader',
  home: 'showHomeButtonInHeader',
  history: 'showHistoryButtonInHeader',
  speed: 'showPlaybackSpeedControl',
  quality: 'showPlaybackQualityControl',
  'sleep-timer': 'showSleepTimerButtonInHeader',
  queue: 'showQueueButtonInHeader',
  scripts: 'showScriptsButtonInHeader',
} as const

const toggleButton = (id: ToolbarButtonId) => {
  if (isMenuToolbarButton(id)) {
    const shown = settings$.toolbarMenuButtons.peek()
    settings$.toolbarMenuButtons.set(shown.includes(id) ? shown.filter((item) => item !== id) : [...shown, id])
  } else {
    const setting = settings$[builtinSettingKey[id]]
    setting.set(!setting.peek())
  }
}

const moveButton = (id: ToolbarButtonId, to: number) => {
  const order = settings$.toolbarButtonOrder.peek()
  const from = order.indexOf(id)
  if (from >= 0 && from !== to && to >= 0 && to < order.length) {
    settings$.toolbarButtonOrder.set(moveItem(order, from, to))
  }
}

type DragPreview = { from: number; to: number }

/**
 * One drag of a row's handle. Everything the release needs lives here and is
 * updated as the finger moves; React state only drives the preview.
 */
const createRowDrag = (
  id: ToolbarButtonId,
  from: number,
  dragY: Animated.Value,
  scroller: SettingsScroller | null,
  setPreview: (preview: DragPreview | null) => void,
) => {
  let fingerDy = 0
  let fingerY = 0
  let scrolled = 0
  let to = from
  let edges: { top: number; bottom: number } | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  // A press that has not moved yet does not scroll, so it cannot reorder anything.
  let moved = false

  const update = () => {
    const count = settings$.toolbarButtonOrder.peek().length
    // Kept within the list: the card clips anything dragged past its ends.
    const offset = Math.min(Math.max(fingerDy + scrolled, -from * ROW_HEIGHT), (count - 1 - from) * ROW_HEIGHT)
    dragY.setValue(offset)
    const next = Math.min(Math.max(0, from + Math.round(offset / ROW_HEIGHT)), count - 1)
    if (next !== to) {
      to = next
      setPreview({ from, to })
    }
  }

  const autoScroll = () => {
    if (!edges || !scroller || !moved) {
      return
    }
    // Half the page at most, so the two zones never overlap on a short screen.
    const edge = Math.min(AUTO_SCROLL_EDGE, (edges.bottom - edges.top) / 2)
    const step = fingerY < edges.top + edge ? -AUTO_SCROLL_STEP : fingerY > edges.bottom - edge ? AUTO_SCROLL_STEP : 0
    // Once the row reaches an end of the list, scrolling on would only carry the list away.
    const last = settings$.toolbarButtonOrder.peek().length - 1
    if ((step < 0 && to > 0) || (step > 0 && to < last)) {
      scrolled += scroller.scrollBy(step)
      update()
    }
  }

  return {
    start: (pageY: number) => {
      fingerY = pageY
      dragY.setValue(0)
      setPreview({ from, to })
      scroller?.measure((top, bottom) => {
        edges = { top, bottom }
      })
      timer = setInterval(autoScroll, 16)
    },
    move: (dy: number, moveY: number) => {
      fingerDy = dy
      fingerY = moveY
      moved ||= Math.abs(dy) > TOUCH_SLOP
      update()
    },
    end: (commit: boolean) => {
      clearInterval(timer)
      setPreview(null)
      // Synced while dragging: the order is not the one the drag started on.
      if (commit && settings$.toolbarButtonOrder.peek()[from] === id) {
        moveButton(id, to)
      }
    },
  }
}

/** Leading toolbar buttons (Android): a switch to show each, a handle to drag it into place. */
export const ToolbarButtonOrderList: React.FC = () => {
  const order = useValue(settings$.toolbarButtonOrder)
  const menuButtons = useValue(settings$.toolbarMenuButtons)
  const settings = useValue(settings$)
  const scroller = useSettingsScroller()
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const dragY = useRef(new Animated.Value(0)).current

  const isShown = (id: ToolbarButtonId) =>
    isMenuToolbarButton(id) ? menuButtons.includes(id) : Boolean(settings[builtinSettingKey[id]])

  const shiftOf = (index: number) => {
    if (!preview || preview.from === index) {
      return 0
    }
    if (preview.from < index && index <= preview.to) {
      return -ROW_HEIGHT
    }
    if (preview.to <= index && index < preview.from) {
      return ROW_HEIGHT
    }
    return 0
  }

  return (
    <View>
      {order.map((id, index) => (
        <ToolbarButtonRow
          key={id}
          id={id}
          index={index}
          count={order.length}
          shown={isShown(id)}
          dragging={preview?.from === index}
          dragY={dragY}
          shift={shiftOf(index)}
          startDrag={() => createRowDrag(id, index, dragY, scroller, setPreview)}
        />
      ))}
    </View>
  )
}

const ToolbarButtonRow: React.FC<{
  id: ToolbarButtonId
  index: number
  count: number
  shown: boolean
  dragging: boolean
  dragY: Animated.Value
  shift: number
  startDrag: () => ReturnType<typeof createRowDrag>
}> = ({ id, index, count, shown, dragging, dragY, shift, startDrag }) => {
  const tw = useTwColor()
  const isDark = useColorScheme() !== 'light'
  const label = getToolbarButtonLabel(id)
  const startDragRef = useRef(startDrag)
  startDragRef.current = startDrag
  const dragRef = useRef<ReturnType<typeof createRowDrag> | null>(null)

  const [responder] = useState(() => {
    const end = (commit: boolean) => {
      dragRef.current?.end(commit)
      dragRef.current = null
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the settings ScrollView from taking over mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        dragRef.current = startDragRef.current()
        dragRef.current.start(event.nativeEvent.pageY)
      },
      onPanResponderMove: (_event, gesture) => dragRef.current?.move(gesture.dy, gesture.moveY),
      onPanResponderRelease: () => end(true),
      onPanResponderTerminate: () => end(false),
    })
  })
  // Leaving the page mid-drag: stop auto-scrolling, keep the order as it was.
  useEffect(() => () => dragRef.current?.end(false), [])

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('settings.toolbarButton.moveUp') }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: t('settings.toolbarButton.moveDown') }] : []),
  ]

  return (
    <Animated.View
      style={{
        height: ROW_HEIGHT,
        zIndex: dragging ? 10 : 0,
        elevation: dragging ? 8 : 0,
        transform: [{ translateY: dragging ? dragY : shift }],
      }}
      className={clsx(
        'bg-white dark:bg-zinc-900',
        dragging && 'rounded-2xl',
        index < count - 1 && !dragging && 'border-b-2 border-zinc-100 dark:border-zinc-950',
      )}
    >
      <Pressable
        onPress={() => toggleButton(id)}
        className="flex-1 flex-row items-center gap-3 pl-4 active:bg-zinc-200/80 dark:active:bg-zinc-800/80"
        accessibilityRole="switch"
        accessibilityState={{ checked: shown }}
        accessibilityLabel={label}
        accessibilityActions={actions}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'moveUp') {
            moveButton(id, index - 1)
          } else if (event.nativeEvent.actionName === 'moveDown') {
            moveButton(id, index + 1)
          }
        }}
      >
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-950">
          <MaterialIcons name={buttonIcon[id]} color={isDark ? tw('zinc-300') : tw('slate-600')} size={18} />
        </View>
        <NouText className="flex-1 font-medium" numberOfLines={1}>
          {label}
        </NouText>
        <Switch
          value={shown}
          onValueChange={() => toggleButton(id)}
          trackColor={{ false: tw('zinc-600'), true: tw('blue-700') }}
          thumbColor={shown ? tw('blue-50') : tw('zinc-100')}
        />
        <View
          className="h-full w-12 items-center justify-center"
          testID={`toolbar-button-handle-${id}`}
          {...responder.panHandlers}
        >
          <MaterialIcons name="drag-indicator" color={isDark ? tw('zinc-500') : tw('zinc-400')} size={22} />
        </View>
      </Pressable>
    </Animated.View>
  )
}
