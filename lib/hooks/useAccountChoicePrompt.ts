import { useEffect } from 'react'
import { Alert } from 'react-native'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import { isWeb } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import { accountChoice$ } from '@/lib/supabase/sync/session'
import { resolveAccountChoice, type AccountChoice } from '@/lib/supabase/sync/account'

export const chooseAccountData = (choice: AccountChoice) =>
  resolveAccountChoice(choice).catch((error) => {
    showToast(t('sync.accountChoiceFailed', { message: error instanceof Error ? error.message : String(error) }))
  })

/** Asks once a session what to do when the data on this device belongs to another account. */
export const useAccountChoicePrompt = () => {
  const needed = useValue(accountChoice$)

  useEffect(() => {
    if (!needed) return
    if (isWeb) {
      // No dialog with three answers on web: the choice waits in Settings › Sync.
      showToast(t('sync.accountChoiceToast'))
      return
    }
    Alert.alert(t('sync.accountChoiceTitle'), t('sync.accountChoiceMessage'), [
      { text: t('sync.accountChoiceLater'), style: 'cancel' },
      { text: t('sync.accountChoiceMerge'), onPress: () => void chooseAccountData('mergeDevice') },
      { text: t('sync.accountChoiceUseAccount'), onPress: () => void chooseAccountData('useAccount') },
    ])
  }, [needed])
}
