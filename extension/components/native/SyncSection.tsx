import { useState } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { NouButton } from '@/components/button/NouButton'
import { NouText } from '@/components/NouText'
import { sectionLabelCls, surfaceCls } from '@/components/modal/SettingsTree'
import { useAppSnapshot } from './AppShell'
import { request } from '../../lib/messages'
import { nIf } from '../../lib/ui'

/*
 * Stands in for the app's sync page. The app signs in through a web login that
 * hands the session to the shell it is running in; here only the background can
 * hold a session, so every button is a message to it.
 */
export const SyncSection = () => {
  const { t } = useTranslation()
  const { snapshot, refresh, setError } = useAppSnapshot()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const signedIn = Boolean(snapshot?.auth.userId)

  return (
    <View>
      <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
      <View className={surfaceCls}>
        <View className="gap-4 px-5 py-5">
          <NouText className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
          <NouText className="text-sm">
            {signedIn ? `${t('sync.currentPlan')}: ${snapshot?.auth.plan}` : t('extension.signedOut')}
          </NouText>

          {nIf(
            !signedIn,
            <NouButton className="self-start" loading={busy} onPress={() => void run(() => request({ type: 'sign-in' }))}>
              {t('extension.signIn')}
            </NouButton>,
          )}

          {nIf(
            signedIn,
            <View className="flex-row flex-wrap gap-3">
              <NouButton loading={busy} onPress={() => void run(() => request({ type: 'sync-now' }))}>
                {t('extension.syncNow')}
              </NouButton>
              <NouButton variant="outline" loading={busy} onPress={() => void run(() => request({ type: 'sign-out' }))}>
                {t('buttons.signOut')}
              </NouButton>
            </View>,
          )}

          {nIf(
            snapshot?.syncError,
            <NouText className="text-sm text-red-600 dark:text-red-400">{snapshot?.syncError}</NouText>,
          )}
        </View>
      </View>
    </View>
  )
}
