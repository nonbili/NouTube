import { View } from 'react-native'
import { NouText } from '../NouText'
import { Image } from 'expo-image'
import { useValue } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { isIos, isWeb } from '@/lib/utils'
import { signOut } from '@/lib/supabase/auth'
import { NouLink } from '../link/NouLink'
import { NouMenu } from '../menu/NouMenu'
import { capitalize } from 'es-toolkit'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'

const surfaceCls = 'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500'

const SettingsBadge: React.FC<{ label: string }> = ({ label }) => {
  return (
    <View className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-950 px-3 py-1">
      <NouText className="text-xs text-zinc-700 dark:text-zinc-300">{label}</NouText>
    </View>
  )
}

function formatPlanLabel(plan?: string) {
  return plan ? capitalize(plan) : 'Free'
}

export const SettingsModalTabSync = () => {
  const { user, plan } = useValue(auth$)
  const planLabel = formatPlanLabel(plan)

  if (!user) {
    return (
      <View className="gap-6">
        <View>
          <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
          <View className={surfaceCls}>
            <View className="px-5 py-5">
              <NouText className="text-lg font-semibold">{t('sync.label')}</NouText>
              <NouText className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
              <View className="mt-5">
                <NouLink
                  className="rounded-full bg-zinc-900 px-5 py-2.5 text-center text-sm text-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                  href="https://noutube.inks.page/auth/app"
                  target="_blank"
                >
                  Login NouTube
                </NouLink>
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="gap-6">
      <View>
        <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
        <View className={surfaceCls}>
          <View className="flex-row items-center gap-3 px-4 py-4">
            <Image
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#18181b' }}
              source={user.picture}
              contentFit="cover"
            />
            <View className="flex-1">
              <NouText className="font-medium">{user.email}</NouText>
              <NouText className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t('sync.currentPlan')}: {planLabel}
              </NouText>
            </View>
            <NouMenu
              trigger={isWeb ? <MaterialButton name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
              items={[{ label: t('buttons.signOut'), handler: signOut }]}
            />
          </View>
        </View>
      </View>

      <View>
        <NouText className={sectionLabelCls}>{t('sync.currentPlan')}</NouText>
        <View className={surfaceCls}>
          <View className="px-5 py-5">
            <View className="flex-row flex-wrap gap-2">
              <SettingsBadge label={planLabel} />
            </View>
            <NouText className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
            <View className="mt-5">
              <NouLink
                className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 px-5 py-2.5 text-center text-sm text-zinc-900 dark:text-zinc-100"
                href="https://noutube.inks.page/app"
              >
                {t('sync.managePlan')}
              </NouLink>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
