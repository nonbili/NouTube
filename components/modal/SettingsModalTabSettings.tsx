import {
  Button,
  Text,
  Pressable,
  View,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../link/NouLink'
import { version } from '../../package.json'
import { useState } from 'react'
import { clsx, isWeb } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segemented } from '../picker/Segmented'
import { getDocumentAsync } from 'expo-document-picker'
import { importCsv } from '@/lib/import'
import { ui$ } from '@/states/ui'

const repo = 'https://github.com/nonbili/NouTube'
const themes = [null, 'dark', 'light'] as const

export const SettingsModalTabSettings = () => {
  const settings = use$(settings$)
  const [importing, setImporting] = useState(false)

  const onClickImport = async () => {
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: 'text/*' })
    setImporting(true)
    try {
      const csv = res.assets?.[0]
      if (csv) {
        const res = await fetch(csv.uri)
        const text = await res.text()
        await importCsv(text)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setImporting(false)
    }
  }

  return (
    <ScrollView>
      <View className="items-center mt-10 flex-row justify-between">
        <Pressable className="flex-1" onPress={() => settings$.hideShorts.set(!settings.hideShorts)}>
          <NouText className="font-medium">Hide shorts</NouText>
        </Pressable>
        <Switch
          value={settings.hideShorts}
          onValueChange={(v) => settings$.hideShorts.set(v)}
          trackColor={{ false: '#767577', true: '#e9d5ff' }}
          thumbColor={settings.hideShorts ? '#6366f1' : '#f4f3f4'}
          {...Platform.select({
            web: {
              activeThumbColor: '#6366f1',
            },
          })}
        />
      </View>
      {!isWeb && (
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
      )}
      <View className="mt-8 flex-row justify-center">
        <TouchableOpacity
          className={clsx(
            'py-2 px-6 text-center bg-[#6366f1] rounded-full flex-row justify-center gap-2',
            importing && 'pointer-events-none',
          )}
          onPress={onClickImport}
        >
          {importing && <ActivityIndicator color="white" />}
          <NouText className="">Import from YouTube Takeout</NouText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
