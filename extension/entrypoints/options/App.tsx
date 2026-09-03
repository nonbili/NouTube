import { View } from 'react-native'
import { browser } from 'wxt/browser'
import { SettingsTree } from '@/components/modal/SettingsTree'
import { NouText } from '@/components/NouText'
import { AppShell, useAppSnapshot } from '../../components/native/AppShell'
import { SyncSection } from '../../components/native/SyncSection'
import { nIf } from '../../lib/ui'

/*
 * The options page is the app's settings, nothing else: the same tree the app
 * shows in its settings modal, with the browser tab standing in for the modal.
 */
const Settings = () => {
  const { error } = useAppSnapshot()

  return (
    <>
      {nIf(
        error,
        <NouText className="bg-red-100 px-4 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{error}</NouText>,
      )}
      <View className="flex-1">
        <SettingsTree
          version={browser.runtime.getManifest().version}
          renderSync={() => <SyncSection />}
          showShellTools={false}
        />
      </View>
    </>
  )
}

export const App = () => (
  <AppShell>
    <Settings />
  </AppShell>
)
