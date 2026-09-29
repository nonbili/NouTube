import { twColor } from './theme'

// Toasts use an inverted surface: a dark chip in light mode, a light chip in
// dark mode. Colors are inlined rather than set through classNames so they
// cannot be overridden by a component's own text color (see NouText).
export interface ToastColors {
  background: string
  text: string
  accent: string
}

// zinc-900 / white / indigo-300 in light mode, zinc-100 / zinc-900 / indigo-700 in dark mode.
export const getToastColors = (isDark: boolean): ToastColors =>
  isDark
    ? { background: twColor('zinc-100'), text: twColor('zinc-900'), accent: twColor('indigo-700') }
    : { background: twColor('zinc-900'), text: '#ffffff', accent: twColor('indigo-300') }
