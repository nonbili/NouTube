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
import { clsx, isWeb, nIf } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segemented } from '../picker/Segmented'
import { getDocumentAsync } from 'expo-document-picker'
import { importCsv, importList, importZip } from '@/lib/import'
import { onClearData$, ui$ } from '@/states/ui'
import NouTubeViewModule from '@/modules/nou-tube-view/src/NouTubeViewModule'
import { showToast } from '@/lib/toast'
import { NouSwitch } from '../switch/NouSwitch'
import { NouButton } from '../button/NouButton'
import { showConfirm } from '@/lib/confirm'
import JSZip from 'jszip'
import { mainClient } from '@/desktop/src/renderer/ipc/main'
/* import { File, Paths } from 'expo-file-system/next' */
import { shareAsync } from 'expo-sharing'
import { bookmarks$ } from '@/states/bookmarks'
import { t } from 'i18next'

const repo = 'https://github.com/nonbili/NouTube'
const themes = [null, 'dark', 'light'] as const

const rowCls = 'mb-6 flex-row justify-between items-center'
const headerCls = 'mb-6 font-semibold text-gray-400'
const labelCls = 'text-gray-200'

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

  const onClickExportList = async () => {
    /* const bookmarks = bookmarks$.bookmarks
     *   .get()
     *   .map((x) => x.url)
     *   .join('\n')
     * const date = new Date().toLocaleDateString()
     * const file = new File(Paths.cache, `NouTube_bookmarks_${Date.now()}.txt`)
     * try {
     *   file.create()
     *   file.write(bookmarks)
     *   await shareAsync(file.uri, {
     *     mimeType: 'text/plain',
     *     dialogTitle: 'Save the file',
     *   })
     * } catch (e) {
     *   console.error(e)
     * } */
  }

  const onClickImportTakeout = async () => {
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: ['application/zip', 'text/*'] })
    setImportingTakeout(true)
    try {
      const asset = res.assets?.[0]
      if (asset) {
        if (asset.size && asset.size > 20 * 1024 * 1024) {
          return
        }
        const res = await fetch(asset.uri)
        if (asset.mimeType == 'application/zip') {
          const buf = await res.arrayBuffer()
          const zip = new JSZip()
          await zip.loadAsync(buf)
          await importZip(zip)
        } else {
          const text = await res.text()
          await importCsv(text, asset.name)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setImportingTakeout(false)
    }
  }

  const clearWebviewData = () => {
    showConfirm('Clear webview data', 'All cookies, browsing history will be removed.', () => {
      onClearData$.fire()
      showToast('WebView data cleared')
    })
  }

  return (
    <>
      <NouText className={headerCls}>{t('settings.general')}</NouText>
      <NouSwitch
        className=""
        label={t('settings.restoreOnStart')}
        value={settings.restoreOnStart}
        onPress={() => settings$.restoreOnStart.set(!settings.restoreOnStart)}
      />
      <NouSwitch
        className="mt-6"
        label={t('settings.hideShorts')}
        value={settings.hideShorts}
        onPress={() => settings$.hideShorts.set(!settings.hideShorts)}
      />
      <NouSwitch
        className="mt-6"
        label="Sponsor block"
        value={settings.sponsorBlock}
        onPress={() => settings$.sponsorBlock.set(!settings.sponsorBlock)}
      />
      <NouSwitch
        className="mt-6"
        label={t('settings.channelsFeed')}
        value={settings.feedsEnabled}
        onPress={() => settings$.feedsEnabled.set(!settings.feedsEnabled)}
      />
      <NouSwitch
        className="my-6"
        label={t('settings.watchHistory')}
        value={settings.keepHistory}
        onPress={() => settings$.keepHistory.set(!settings.keepHistory)}
      />
      {nIf(
        !isWeb,
        <View className="my-6">
          <View className="items-center flex-row justify-between">
            <NouText className="font-medium">{t('settings.theme.label')}</NouText>
            <Segemented
              options={[t('settings.theme.system'), t('settings.theme.dark'), t('settings.theme.light')]}
              selectedIndex={themes.indexOf(settings.theme)}
              size={1}
              onChange={(index) => settings$.theme.set(themes[index])}
            />
          </View>
          <NouText className="mt-2 text-sm text-gray-400 text-right">{t('settings.theme.hint')}</NouText>
        </View>,
      )}
      <View className="h-4" />

      {nIf(
        isWeb,
        <View className={rowCls}>
          <NouText className={labelCls}>{t('settings.login.label')}</NouText>
          <NouButton size="1" onPress={() => mainClient.openLoginWindow()}>
            {t('settings.login.button')}
          </NouButton>
        </View>,
      )}
      <View className={rowCls}>
        <NouText className={labelCls}>{t('settings.openUrlLabel')}</NouText>
        <NouButton size="1" onPress={() => ui$.urlModalOpen.set(true)}>
          {t('buttons.openUrl')}
        </NouButton>
      </View>
      <View className={rowCls}>
        <NouText className={labelCls}>{t('settings.webview.clearLabel')}</NouText>
        <NouButton size="1" variant="outline" onPress={clearWebviewData}>
          {t('buttons.clear')}
        </NouButton>
      </View>

      <NouText className={clsx(headerCls, 'mt-4')}>{t('buttons.import')}</NouText>
      <View className={rowCls}>
        <NouText className={labelCls}>{t('settings.importList')}</NouText>
        <NouButton size="1" variant="soft" loading={importingList} onPress={onClickImportList}>
          {t('buttons.import')}
        </NouButton>
      </View>
      <View className={rowCls}>
        <NouText className={labelCls}>{t('settings.importTakeout')}</NouText>
        <NouButton size="1" variant="soft" loading={importingTakeout} onPress={onClickImportTakeout}>
          {t('buttons.import')}
        </NouButton>
      </View>

      {nIf(
        !isWeb,
        <>
          <NouText className={clsx(headerCls, 'mt-4')}>{t('buttons.export')}</NouText>
          <View className={rowCls}>
            <NouText className={labelCls}>{t('settings.exportLabel')}</NouText>
            <NouButton size="1" variant="soft" loading={importingList} onPress={onClickExportList}>
              {t('buttons.export')}
            </NouButton>
          </View>
        </>,
      )}

      <View className="h-20" />
    </>
  )
}
