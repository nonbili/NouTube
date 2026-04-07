import { useQuery } from '@tanstack/react-query'
import { Linking, Pressable, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { version } from '../../package.json'
import { version as desktopVersion } from '../../desktop/package.json'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { clsx, isWeb } from '@/lib/utils'
import { t } from 'i18next'
import { getReleaseFeedQuery } from '@/lib/query/changelog'

const surfaceCls = 'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'

function formatReleaseDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

export const SettingsChangelogContent = () => {
  const currentVersion = `v${isWeb ? desktopVersion : version}`
  const { data, isLoading, isError, refetch, isFetching } = useQuery(getReleaseFeedQuery())

  if (isLoading) {
    return (
      <View className={surfaceCls}>
        <NouText className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">{t('changelog.loading')}</NouText>
      </View>
    )
  }

  if (isError) {
    return (
      <View className="gap-4">
        <View className={surfaceCls}>
          <NouText className="px-4 py-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('changelog.error')}</NouText>
        </View>
        <View className="items-end">
          <NouButton variant="outline" loading={isFetching} onPress={() => void refetch()}>
            {t('changelog.retry')}
          </NouButton>
        </View>
      </View>
    )
  }

  if (!data?.length) {
    return (
      <View className={surfaceCls}>
        <NouText className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">{t('changelog.empty')}</NouText>
      </View>
    )
  }

  return (
    <View className="gap-4">
      {data.map((entry) => {
        const isCurrent = entry.tag === currentVersion

        return (
          <Pressable
            key={entry.url}
            onPress={() => {
              void Linking.openURL(entry.url)
            }}
            className="rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70 px-4 py-4 active:bg-zinc-200/80 dark:active:bg-zinc-800/80"
          >
            <View className="flex-row items-start gap-3">
              <View
                className={clsx(
                  'mt-0.5 h-10 w-10 items-center justify-center rounded-2xl border bg-zinc-200 dark:bg-zinc-950',
                  isCurrent ? 'border-blue-500' : 'border-zinc-300 dark:border-zinc-800',
                )}
              >
                <MaterialIcons name="history" color={isCurrent ? '#93c5fd' : '#64748b'} size={18} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <NouText className="flex-1 text-base font-semibold tracking-tight">{entry.tag}</NouText>
                  {isCurrent ? (
                    <View className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1">
                      <NouText className="text-[10px] uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                        {t('changelog.current')}
                      </NouText>
                    </View>
                  ) : null}
                </View>
                <NouText className="mt-1 text-sm text-zinc-500">{formatReleaseDate(entry.updatedAt)}</NouText>
                <View className="mt-4 gap-2">
                  {entry.items.length ? (
                    entry.items.map((item) => (
                      <View className="flex-row gap-2" key={`${entry.url}-${item}`}>
                        <NouText className="text-sm leading-6 text-zinc-500">{'\u2022'}</NouText>
                        <NouText className="flex-1 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{item}</NouText>
                      </View>
                    ))
                  ) : (
                    <NouText className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('changelog.noNotes')}</NouText>
                  )}
                </View>
              </View>
              <MaterialIcons name="open-in-new" color="#71717a" size={18} />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
