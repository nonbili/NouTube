import { Pressable, Switch, TextInput, View, useColorScheme } from 'react-native'
import { useState } from 'react'
import { useValue } from '@legendapp/state/react'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { t } from 'i18next'
import { blocklist$ } from '@/states/blocklist'
import type { BlocklistEntry, BlocklistKind } from '@/lib/blocklist'
import { clsx, isWeb, nIf } from '@/lib/utils'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'

const surfaceCls = 'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500'
const iconWrapCls = 'h-10 w-10 items-center justify-center rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-950'
const rowDividerCls = 'border-b border-zinc-300 dark:border-zinc-800'

const SettingsSection: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <View>
    <NouText className={sectionLabelCls}>{label}</NouText>
    {children}
  </View>
)

const BlocklistRow: React.FC<{
  entry: BlocklistEntry
  kind: BlocklistKind
  isLast: boolean
}> = ({ entry, kind, isLast }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const toggle = () => {
    if (kind === 'channel') {
      blocklist$.toggleChannel(entry.id)
    } else {
      blocklist$.toggleKeyword(entry.id)
    }
  }
  const remove = () => {
    if (kind === 'channel') {
      blocklist$.deleteChannel(entry.id)
    } else {
      blocklist$.deleteKeyword(entry.id)
    }
  }

  return (
    <View className={clsx('flex-row items-center gap-3 px-4 py-3', !isLast && 'border-b border-zinc-300 dark:border-zinc-800')}>
      <Pressable onPress={toggle} className="flex-1">
        <NouText className={clsx('font-medium', !entry.enabled && 'text-zinc-500 dark:text-zinc-500')} numberOfLines={1}>
          {entry.value}
        </NouText>
      </Pressable>
      <View {...(isWeb ? { onClick: (e: any) => e.stopPropagation() } : {})}>
        <Switch
          value={entry.enabled}
          onValueChange={toggle}
          trackColor={{ false: '#52525b', true: '#1d4ed8' }}
          thumbColor={entry.enabled ? '#eff6ff' : '#f4f4f5'}
          {...(isWeb ? { activeThumbColor: '#eff6ff' } : {})}
        />
      </View>
      <Pressable onPress={remove} className="h-10 w-10 items-center justify-center rounded-full active:bg-zinc-200 dark:active:bg-zinc-800">
        <MaterialIcons name="delete-outline" size={20} color={isDark ? '#d4d4d8' : '#475569'} />
      </Pressable>
    </View>
  )
}

const BlocklistSection: React.FC<{
  label: string
  placeholder: string
  empty: string
  note: string
  icon: keyof typeof MaterialIcons.glyphMap
  kind: BlocklistKind
  entries: BlocklistEntry[]
}> = ({ label, placeholder, empty, note, icon, kind, entries }) => {
  const [value, setValue] = useState('')
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const add = () => {
    const id = kind === 'channel' ? blocklist$.addChannel(value) : blocklist$.addKeyword(value)
    if (id) {
      setValue('')
    }
  }

  return (
    <SettingsSection label={label}>
      <View className={surfaceCls}>
        <View className={clsx('flex-row items-center gap-3 px-4 py-4', rowDividerCls)}>
          <View className={iconWrapCls}>
            <MaterialIcons name={icon} color={isDark ? '#d4d4d8' : '#475569'} size={18} />
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            onSubmitEditing={add}
            placeholder={placeholder}
            placeholderTextColor={isDark ? '#71717a' : '#64748b'}
            className="min-h-11 flex-1 rounded-2xl border border-zinc-300 bg-zinc-50 px-3 text-base text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <NouButton size="1" variant="outline" onPress={add} disabled={!value.trim()}>
            {t('settings.blocklist.add')}
          </NouButton>
        </View>

        <View className={clsx('flex-row gap-3 px-4 py-3 bg-zinc-50/70 dark:bg-zinc-950/30', entries.length > 0 && rowDividerCls)}>
          <MaterialIcons name="info-outline" color={isDark ? '#a1a1aa' : '#64748b'} size={18} />
          <NouText className="flex-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{note}</NouText>
        </View>

        {nIf(
          entries.length === 0,
          <View className="px-4 py-5">
            <NouText className="text-sm text-zinc-600 dark:text-zinc-400">{empty}</NouText>
          </View>,
        )}

        {entries.map((entry, index) => (
          <BlocklistRow key={entry.id} entry={entry} kind={kind} isLast={index === entries.length - 1} />
        ))}
      </View>
    </SettingsSection>
  )
}

export const SettingsBlocklistContent = () => {
  const blocklist = useValue(blocklist$)

  return (
    <View className="gap-6">
      <BlocklistSection
        label={t('settings.blocklist.channels')}
        placeholder={t('settings.blocklist.channelPlaceholder')}
        empty={t('settings.blocklist.emptyChannels')}
        note={t('settings.blocklist.channelsNote')}
        icon="account-circle"
        kind="channel"
        entries={blocklist.channels}
      />
      <BlocklistSection
        label={t('settings.blocklist.keywords')}
        placeholder={t('settings.blocklist.keywordPlaceholder')}
        empty={t('settings.blocklist.emptyKeywords')}
        note={t('settings.blocklist.keywordsNote')}
        icon="filter-alt"
        kind="keyword"
        entries={blocklist.keywords}
      />
    </View>
  )
}
