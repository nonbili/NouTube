import { View } from 'react-native'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import { ui$ } from '@/states/ui'
import { desktopShortcuts, formatShortcut } from '@/lib/desktop-shortcuts'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'

const getPlatform = (): string => (globalThis as any).window?.electron?.process?.platform ?? ''

const Keys: React.FC<{ value: string }> = ({ value }) => (
  <View className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
    <NouText className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{value}</NouText>
  </View>
)

/* Desktop only: lists the shortcuts from lib/desktop-shortcuts.ts. */
export const ShortcutsModal = () => {
  const open = useValue(ui$.shortcutsModalOpen)
  if (!open) {
    return null
  }
  const platform = getPlatform()
  const onClose = () => ui$.shortcutsModalOpen.set(false)
  const rows = [
    ...desktopShortcuts.map((shortcut) => ({
      label: t(`shortcuts.${shortcut.action}`),
      keys: formatShortcut(shortcut, platform),
    })),
    { label: t('shortcuts.closeModal'), keys: 'Esc' },
  ]

  return (
    <BaseCenterModal onClose={onClose} containerClassName="w-[28rem] max-w-[88vw]">
      <View className="p-6">
        <NouText className="text-lg font-semibold">{t('shortcuts.title')}</NouText>
        <View className="mt-4">
          {rows.map((row) => (
            <View key={row.label} className="flex-row items-center justify-between gap-4 py-2">
              <NouText className="text-sm">{row.label}</NouText>
              <Keys value={row.keys} />
            </View>
          ))}
        </View>
        <NouText className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{t('shortcuts.hint')}</NouText>
      </View>
    </BaseCenterModal>
  )
}
