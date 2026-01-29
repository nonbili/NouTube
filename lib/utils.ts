// https://github.com/ai/nanoid#react-native
import 'react-native-get-random-values'
import { nanoid } from 'nanoid'
import { ReactNode } from 'react'
import { Platform } from 'react-native'

export const isWeb = typeof document != 'undefined'
export const isIos = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'

export const clsx = (...classes: Array<string | boolean | undefined>) => classes.filter(Boolean).join(' ')

// In react-native, writing {condition && <Cmp/>} triggers `A text node cannot be a child of a <View>` warning.
export const nIf = (condition: any, node: ReactNode) => (condition ? node : null)

export function genId(size = 16) {
  return nanoid(size)
}
