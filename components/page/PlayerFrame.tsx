import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useValue } from '@legendapp/state/react'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { settings$ } from '@/states/settings'
import { closePlayer, showPlayer } from '@/lib/split-view'

const MARGIN = 12
const MAX_WIDTH = 260
const WIDTH_RATIO = 0.58

const buttonStyle = {
  position: 'absolute' as const,
  top: 6,
  width: 28,
  height: 28,
  borderRadius: 999,
  backgroundColor: 'rgba(0,0,0,0.62)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}

/**
 * Holds the player webview in whichever shape the split watch view is in:
 * covering the browsing page, shrunk into the mini player, or waiting out of
 * sight while still playing.
 *
 * The element tree is deliberately identical in all three -- only styles and
 * the mini chrome change. Swapping the wrapper instead would make React
 * remount the webview, which would reload the video and lose its position, and
 * that is the whole thing this feature exists to avoid. The page lays itself
 * out for the small box on its own (see setNativeMini in
 * content/split-view.ts); the controls live here because the box is too small
 * to hit YouTube's own, and a tap on it means "give me the video back".
 */
export const PlayerFrame: React.FC<{
  children: React.ReactNode
  mode: 'full' | 'mini' | 'hidden'
  playing: boolean
  onTogglePlay: () => void
}> = ({ children, mode, playing, onTogglePlay }) => {
  const isMini = mode === 'mini'
  const isFull = mode === 'full'
  // Measured rather than taken from the window: the frame lives inside the
  // webview container, which the toolbar has already inset.
  const [area, setArea] = useState({ width: 0, height: 0 })
  const position = useValue(settings$.miniPlayerPosition)
  const boxWidth = Math.min(area.width * WIDTH_RATIO, MAX_WIDTH)
  const boxHeight = Math.round((boxWidth * 9) / 16)
  // The room the box's top-left corner can move in, inside the margins.
  const rangeX = Math.max(0, area.width - boxWidth - MARGIN * 2)
  const rangeY = Math.max(0, area.height - boxHeight - MARGIN * 2)

  // Where the box sits before any drag: wherever the user last dropped it.
  const base = useMemo(
    () => ({ x: MARGIN + (position?.x ?? 1) * rangeX, y: MARGIN + (position?.y ?? 1) * rangeY }),
    [position, rangeX, rangeY],
  )

  // The drag moves the view directly instead of going through state: a
  // re-render mid-drag would re-render the webview inside the frame.
  const frameRef = useRef<View>(null)

  const clampToArea = (dx: number, dy: number) => ({
    left: Math.min(MARGIN + rangeX, Math.max(MARGIN, base.x + dx)),
    top: Math.min(MARGIN + rangeY, Math.max(MARGIN, base.y + dy)),
  })

  // Stay wherever the box was let go, kept inside the margins.
  const drop = (dx: number, dy: number) => {
    const { left, top } = clampToArea(dx, dy)
    settings$.miniPlayerPosition.set({
      x: rangeX ? (left - MARGIN) / rangeX : 1,
      y: rangeY ? (top - MARGIN) / rangeY : 1,
    })
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Capture, not the bubbling variant: the expand Pressable below covers
        // the whole box and claims the responder on touch down, and RN only
        // asks ancestors on capture once a descendant holds it.
        onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
          isMini && (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6),
        onPanResponderMove: (_evt, gesture) => {
          frameRef.current?.setNativeProps({ style: clampToArea(gesture.dx, gesture.dy) })
        },
        // Keep the drag: the webview inside would otherwise take the touch
        // back on Android and end it early.
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_evt, gesture) => drop(gesture.dx, gesture.dy),
        // Ended by the system anyway: still stay where the box got to.
        onPanResponderTerminate: (_evt, gesture) => drop(gesture.dx, gesture.dy),
      }),
    [base, rangeX, rangeY, isMini],
  )

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setArea((current) => (current.width === width && current.height === height ? current : { width, height }))
  }

  const frameStyle = isMini
    ? {
        position: 'absolute' as const,
        left: base.x,
        top: base.y,
        width: boxWidth,
        height: boxHeight,
        zIndex: 1,
        borderRadius: 8,
        overflow: 'hidden' as const,
        backgroundColor: '#000',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.42,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      }
    : [StyleSheet.absoluteFill, { opacity: isFull ? 1 : 0, zIndex: isFull ? 1 : 0 }]

  return (
    // box-none in the mini player: only the small box takes touches, the
    // browsing page keeps the rest of the screen.
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={isFull ? 'auto' : isMini ? 'box-none' : 'none'}
      onLayout={onLayout}
    >
      <View ref={frameRef} style={frameStyle} {...(isMini ? panResponder.panHandlers : {})}>
        {children}
        {/* Over the webview, so the page never sees these taps. */}
        {isMini ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={showPlayer} accessibilityLabel="Expand video" />
            <Pressable style={[buttonStyle, { left: 6 }]} onPress={onTogglePlay}>
              <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={18} color="#fff" />
            </Pressable>
            <Pressable style={[buttonStyle, { right: 6 }]} onPress={closePlayer}>
              <MaterialIcons name="close" size={18} color="#fff" />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  )
}
