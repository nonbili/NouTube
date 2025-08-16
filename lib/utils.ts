// https://github.com/ai/nanoid#react-native
import 'react-native-get-random-values'
import { nanoid } from 'nanoid'

export const isWeb = typeof document != 'undefined'

export const clsx = (...classes: Array<string | boolean | undefined>) => classes.filter(Boolean).join(' ')

export function genId(size = 16) {
  return nanoid(size)
}
