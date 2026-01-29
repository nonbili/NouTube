import { ScrollView, View } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../link/NouLink'
import { version } from '../../package.json'
import { version as desktopVersion } from '../../desktop/package.json'
import { useState } from 'react'
import { isIos, isWeb } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { Segmented } from '../picker/Segmented'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { SettingsModalTabSync } from './SettingsModalTabSync'
import { SettingsModalTabSettings } from './SettingsModalTabSettings'
import { t } from 'i18next'

const repo = 'https://github.com/nonbili/NouTube'
const tabs = [t('settings.label'), t('sync.label'), t('about.label')]
const donateLinks = ['https://github.com/sponsors/rnons', 'https://liberapay.com/rnons', 'https://paypal.me/rnons']

function renderTab(tabIndex: number) {
  switch (tabIndex) {
    case 0:
      return <SettingsModalTabSettings />
    case 1:
      return isIos ? (
        <View>
          <NouText className="text-2xl text-center mt-8">Work in progress</NouText>
        </View>
      ) : (
        <SettingsModalTabSync />
      )
    case 2:
      return (
        <>
          <View className="items-center my-8">
            <NouText className="text-lg font-medium">NouTube</NouText>
            <NouText>v{isWeb ? desktopVersion : version}</NouText>
          </View>
          <View className="mb-6">
            <NouText className="font-medium mb-1">{t('about.code')}</NouText>
            <NouLink className="text-indigo-400 text-sm" href={repo}>
              {repo}
            </NouLink>
          </View>
          <View className="mb-6">
            <NouText className="font-medium mb-1">{t('about.donate')}</NouText>
            {donateLinks.map((url) => (
              <NouLink className="text-indigo-400 text-sm mb-2" href={url} key={url}>
                {url}
              </NouLink>
            ))}
          </View>
        </>
      )
    default:
      return null
  }
}

export const SettingsModal = () => {
  const settingsModalOpen = useValue(ui$.settingsModalOpen)
  const [tabIndex, setTabIndex] = useState(0)

  return (
    settingsModalOpen && (
      <BaseModal onClose={() => ui$.settingsModalOpen.set(false)}>
        <View className="items-center my-4">
          <Segmented options={tabs} selectedIndex={tabIndex} onChange={setTabIndex} />
        </View>
        <ScrollView className="px-4">{renderTab(tabIndex)}</ScrollView>
      </BaseModal>
    )
  )
}
