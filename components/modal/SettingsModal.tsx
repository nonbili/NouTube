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

const repo = 'https://github.com/nonbili/NouTube'
const tabs = ['Settings', 'About']

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tabIndex, setTabIndex] = useState(0)
  const hideShorts = use$(settings$.hideShorts)

  return (
    <Modal animationType="slide" transparent={true} visible={true} onRequestClose={onClose}>
      <View className="flex-1 bg-[#222] py-6 px-8">
        <View className="w-full gap-x-3 gap-y-2 flex flex-row mb-4">
          {tabs.map((tab, index) => {
            const active = index == tabIndex
            return (
              <Pressable
                key={tab}
                onPress={() => setTabIndex(index)}
                className={clsx('px-4 py-2 rounded-md', active ? 'bg-gray-100' : 'bg-[#3c3c3c]')}
              >
                <NouText className={clsx('font-medium', active && 'text-gray-900')}>{tab}</NouText>
              </Pressable>
            )
          })}
        </View>
        <View className="flex-1">
          {tabIndex == 0 && (
            <View className="items-center my-8 flex-row justify-between">
              <Pressable className="flex-1" onPress={() => settings$.hideShorts.set(!hideShorts)}>
                <NouText className="font-medium">Hide shorts</NouText>
              </Pressable>
              <Switch
                style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
                value={hideShorts}
                onValueChange={(v) => settings$.hideShorts.set(v)}
                trackColor={{ false: '#767577', true: '#e9d5ff' }}
                thumbColor={hideShorts ? '#6366f1' : '#f4f3f4'}
              />
            </View>
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
