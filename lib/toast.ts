import { toast } from 'react-hot-toast'
import { Appearance } from 'react-native'
import { getToastColors } from './toast-theme'

export function showToast(msg: string) {
  // Appearance follows settings$.theme, falling back to the system scheme.
  const colors = getToastColors(Appearance.getColorScheme() !== 'light')
  toast(msg, {
    icon: '🦦',
    style: { background: colors.background, color: colors.text },
  })
}
