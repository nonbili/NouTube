import { Button, ScrollView, View } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../link/NouLink'
import { version } from '../../package.json'
import { version as desktopVersion } from '../../desktop/package.json'
import { useState } from 'react'
import { clsx, isWeb } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { Segemented } from '../picker/Segmented'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { SettingsModalTabSync } from './SettingsModalTabSync'
import { SettingsModalTabSettings } from './SettingsModalTabSettings'

const repo = 'https://github.com/nonbili/NouTube'
const tabs = ['Settings', 'Sync', 'About']
const themes = [null, 'dark', 'light'] as const
const donateLinks = ['https://github.com/sponsors/rnons', 'https://liberapay.com/rnons', 'https://paypal.me/rnons']

export const SettingsModal = () => {
  const settingsModalOpen = use$(ui$.settingsModalOpen)
  const [tabIndex, setTabIndex] = useState(0)

  return (
    settingsModalOpen && (
      <BaseModal onClose={() => ui$.settingsModalOpen.set(false)}>
        <View className="items-center my-4">
          <Segemented options={tabs} selectedIndex={tabIndex} onChange={setTabIndex} />
        </View>
        <ScrollView className="px-4">
          {tabIndex == 0 && <SettingsModalTabSettings />}
          {tabIndex == 1 && <SettingsModalTabSync />}
          {tabIndex == 2 && (
            <>
              <View className="items-center my-8">
                <NouText className="text-lg font-medium">NouTube</NouText>
                <NouText>v{isWeb ? desktopVersion : version}</NouText>
              </View>
              <View className="mb-6">
                <NouText className="font-medium">Source code</NouText>
                <NouLink className="text-indigo-400 text-sm" href={repo}>
                  {repo}
                </NouLink>
              </View>
              <View className="mb-6">
                <NouText className="font-medium mb-1">Donate</NouText>
                {donateLinks.map((url) => (
                  <NouLink className="text-indigo-400 text-sm mb-2" href={url} key={url}>
                    {url}
                  </NouLink>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </BaseModal>
    )
  )
}
