import { Modal, Text, Pressable, View, Switch } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../NouLink'
import { version } from '../../package.json'
import { useState } from 'react'
/* import { Picker, Switch } from '@expo/ui/jetpack-compose' */
import { colors } from '@/lib/colors'
import { clsx } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segemented } from '../picker/Segmented'

const repo = 'https://github.com/nonbili/NouTube'
const tabs = ['Settings', 'About']
const themes = [null, 'dark', 'light'] as const

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tabIndex, setTabIndex] = useState(0)
  const settings = use$(settings$)

  return (
    <Modal animationType="slide" transparent={true} visible={true} onRequestClose={onClose}>
      <View className="flex-1 bg-[#222] py-6 px-4">
        <View className="items-center">
          <Segemented options={tabs} selectedIndex={tabIndex} onChange={setTabIndex} />
        </View>
        <View className="flex-1">
          {tabIndex == 0 && (
            <>
              <View className="items-center mt-10 flex-row justify-between">
                <Pressable className="flex-1" onPress={() => settings$.hideShorts.set(!settings.hideShorts)}>
                  <NouText className="font-medium">Hide shorts</NouText>
                </Pressable>
                <Switch
                  style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
                  value={settings.hideShorts}
                  onValueChange={(v) => settings$.hideShorts.set(v)}
                  trackColor={{ false: '#767577', true: '#e9d5ff' }}
                  thumbColor={settings.hideShorts ? '#6366f1' : '#f4f3f4'}
                />
              </View>
              <View className="my-6">
                <View className="items-center flex-row justify-between">
                  <NouText className="font-medium">YouTube Theme</NouText>
                  <Segemented
                    options={['System', 'Dark', 'Light']}
                    selectedIndex={themes.indexOf(settings.theme)}
                    size={1}
                    onChange={(index) => settings$.theme.set(themes[index])}
                  />
                </View>
                <NouText className="mt-2 text-sm text-gray-400 text-right">
                  Restart manually if change not reflected in webview.
                </NouText>
              </View>
            </>
          )}
          {tabIndex == 1 && (
            <>
              <View className="items-center my-8">
                <NouText className="text-lg font-medium">NouTube</NouText>
                <NouText>v{version}</NouText>
              </View>
              <View className="">
                <NouText className="font-medium">Source code</NouText>
                <NouLink className="text-blue-300" href={repo}>
                  {repo}
                </NouLink>
              </View>
            </>
          )}
        </View>
        <View className="items-center mt-12">
          <Pressable onPress={onClose}>
            <NouText className="text-lg py-2 px-6 text-center bg-gray-700 rounded-full">Close</NouText>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
