import { nanoid } from 'nanoid'
import type { ReactNode } from 'react'

/*
 * Replaces `@/lib/utils`, which reaches for react-native's Platform and the
 * react-native-get-random-values polyfill. The extension is a browser, and the
 * background has no DOM at all, so the platform answers are constants here.
 */
export const isWeb = true
export const isIos = false
export const isAndroid = false

export const clsx = (...classes: Array<string | boolean | undefined>) => classes.filter(Boolean).join(' ')

export const nIf = (condition: any, node: ReactNode) => (condition ? node : null)

export function genId(size = 16) {
  return nanoid(size)
}
