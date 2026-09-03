import type { ReactNode } from 'react'

/* Local copies: `@/lib/utils` pulls in react-native, which has no place here. */
export const clsx = (...classes: Array<string | boolean | undefined>) => classes.filter(Boolean).join(' ')

export const nIf = (condition: any, node: ReactNode) => (condition ? node : null)
