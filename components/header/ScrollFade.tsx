import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

const FADE_WIDTH = 28

/** Fades the edge of a horizontal scroller into `color` to hint at buttons scrolled out of view. */
export const ScrollFade: React.FC<{ side: 'left' | 'right'; color: string; visible: boolean }> = ({
  side,
  color,
  visible,
}) => {
  const id = `scroll-fade-${side}`
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, width: FADE_WIDTH, [side]: 0, opacity: visible ? 1 : 0 }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1={side === 'left' ? '1' : '0'} y1="0" x2={side === 'left' ? '0' : '1'} y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  )
}
