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
  Alert,
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
import { importCsv, importList } from '@/lib/import'
import { onClearData$, ui$ } from '@/states/ui'
import NouTubeViewModule from '@/modules/nou-tube-view/src/NouTubeViewModule'
import { showToast } from '@/lib/toast'
import { NouSwitch } from '../switch/NouSwitch'
import { NouButton } from '../button/NouButton'

const repo = 'https://github.com/nonbili/NouTube'
const themes = [null, 'dark', 'light'] as const

export const SettingsModalTabSettings = () => {
  const settings = use$(settings$)
  const [importingList, setImportingList] = useState(false)
  const [importingTakeout, setImportingTakeout] = useState(false)

  const onClickImportList = async () => {
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: 'text/*' })
    setImportingList(true)
    try {
      const csv = res.assets?.[0]
      if (csv) {
        const res = await fetch(csv.uri)
        const text = await res.text()
        await importList(text)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setImportingList(false)
    }
  }

  const onClickImportTakeout = async () => {
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: 'text/*' })
    setImportingTakeout(true)
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
      setImportingTakeout(false)
    }
  }

  const clearWebviewData = () => {
    Alert.alert('Clear webview data', 'All cookies, browsing history will be removed.', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Yes',
        onPress: () => {
          onClearData$.fire()
          showToast('WebView data cleared')
        },
        style: 'default',
      },
    ])
  }

  return (
    <ScrollView>
      <NouSwitch
        className="mt-10"
        label="Hide shorts"
        value={settings.hideShorts}
        onPress={() => settings$.hideShorts.set(!settings.hideShorts)}
      />
      <NouSwitch
        className="my-6"
        label="Watch history"
        value={settings.keepHistory}
        onPress={() => settings$.keepHistory.set(!settings.keepHistory)}
      />
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
      {!isWeb && (
        <View className="mt-8 flex-row justify-center">
          <TouchableOpacity
            className={clsx(
              'py-2 px-6 text-center border border-indigo-300 rounded-full flex-row justify-center gap-2',
            )}
            onPress={clearWebviewData}
          >
            <NouText className="">Clear webview data</NouText>
          </TouchableOpacity>
        </View>
      )}
      <View className="mt-8 flex-row justify-center">
        <NouButton loading={importingList} onPress={onClickImportList}>
          Import a list of links
        </NouButton>
      </View>
      <View className="mt-8 flex-row justify-center">
        <NouButton loading={importingTakeout} onPress={onClickImportTakeout}>
          Import from YouTube Takeout
        </NouButton>
      </View>

      <View className="h-20" />
    </ScrollView>
  )
}
