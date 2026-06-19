import { ActivityIndicator, Platform, Pressable, Switch, TextInput, View, useColorScheme } from 'react-native'
import { useState } from 'react'
import { useLocales } from 'expo-localization'
import { clsx, isAndroid, isWeb, nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { settings$, ZOOM_PRESETS } from '@/states/settings'
import { Segmented } from '../picker/Segmented'
import { NouMenu } from '../menu/NouMenu'
import { getDocumentAsync } from 'expo-document-picker'
import { importCsv, importList, importZip } from '@/lib/import'
import { onClearData$, ui$ } from '@/states/ui'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { showToast } from '@/lib/toast'
import { showConfirm } from '@/lib/confirm'
import JSZip from 'jszip'
import { bookmarks$ } from '@/states/bookmarks'
import { t } from 'i18next'
import { saveFile } from '@/lib/file'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { formatSleepTimerRemaining, useSleepTimerStatus } from '@/lib/sleep-timer'
import { hasSleepTimerNativeSupport } from '@/lib/sleep-timer-native'
import { mainClient } from '@/lib/main-client'
import { i18nLanguageNativeNames, resolveI18nLanguageFromExpoLocale, supportedI18nLanguages } from '@/lib/i18n'

const themes = [null, 'dark', 'light'] as const
const headerPositions = ['top', 'bottom'] as const
const surfaceCls =
  'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500'
const iconWrapCls =
  'h-10 w-10 items-center justify-center rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-950'

const SettingsSection: React.FC<React.PropsWithChildren<{ label?: string }>> = ({ label, children }) => {
  return (
    <View>
      {label ? <NouText className={sectionLabelCls}>{label}</NouText> : null}
      {children}
    </View>
  )
}

const SettingsToggleRow: React.FC<{
  label: string
  icon: keyof typeof MaterialIcons.glyphMap
  value: boolean
  onPress: () => void
  isLast?: boolean
}> = ({ label, icon, value, onPress, isLast = false }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  return (
    <Pressable
      onPress={onPress}
      className={clsx(
        'flex-row items-center gap-3 px-4 py-4 active:bg-zinc-200/80 dark:active:bg-zinc-800/80',
        !isLast && 'border-b border-zinc-300 dark:border-zinc-800',
      )}
    >
      <View className={iconWrapCls}>
        <MaterialIcons name={icon} color={isDark ? '#d4d4d8' : '#475569'} size={18} />
      </View>
      <NouText className="flex-1 font-medium">{label}</NouText>
      <View {...(isWeb ? { onClick: (e: any) => e.stopPropagation() } : {})}>
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#52525b', true: '#1d4ed8' }}
          thumbColor={value ? '#eff6ff' : '#f4f4f5'}
          {...Platform.select({
            web: {
              activeThumbColor: '#eff6ff',
            },
          })}
        />
      </View>
    </Pressable>
  )
}

export const SettingsActionRow: React.FC<{
  label: string
  description?: string
  icon: keyof typeof MaterialIcons.glyphMap
  onPress: () => void
  isLast?: boolean
  loading?: boolean
  disabled?: boolean
}> = ({ label, description, icon, onPress, isLast = false, loading = false, disabled = false }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={clsx(
        'flex-row items-center gap-3 px-4 py-4 active:bg-zinc-200/80 dark:active:bg-zinc-800/80',
        isDisabled && 'opacity-70',
        !isLast && 'border-b border-zinc-300 dark:border-zinc-800',
      )}
    >
      <View className={iconWrapCls}>
        <MaterialIcons name={icon} color={isDark ? '#d4d4d8' : '#475569'} size={18} />
      </View>
      <View className="flex-1">
        <NouText className="font-medium">{label}</NouText>
        {description ? (
          <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{description}</NouText>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={isDark ? '#d4d4d8' : '#475569'} />
      ) : (
        <MaterialIcons name="chevron-right" color={isDark ? '#71717a' : '#52525b'} size={20} />
      )}
    </Pressable>
  )
}

const clickbaitOptions = ['default', 'hq1', 'hq2', 'hq3'] as const

const clickbaitLabel = (value: (typeof clickbaitOptions)[number]) => {
  if (value === 'default') return t('settings.clickbaitThumbnail.optionDefault')
  return t('settings.clickbaitThumbnail.optionFrame', { n: Number(value.slice(2)) })
}

export const SettingsPreferencesContent = () => {
  const settings = useValue(settings$)
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  const clickbaitMenuItems = clickbaitOptions.map((option) => ({
    label: clickbaitLabel(option),
    handler: () => settings$.clickbaitThumbnail.set(option),
    meta:
      settings.clickbaitThumbnail === option ? (
        <MaterialIcons name="check" size={18} color={isDark ? '#60a5fa' : '#1d4ed8'} />
      ) : undefined,
  }))

  return (
    <View className="pb-4">
      <SettingsSection label={t('settings.preferencesGeneral')}>
        <View className={surfaceCls}>
          <SettingsToggleRow
            label={t('settings.restoreOnStart')}
            icon="restore"
            value={settings.restoreOnStart}
            onPress={() => settings$.restoreOnStart.set(!settings.restoreOnStart)}
          />
          {nIf(
            !isWeb,
            <SettingsToggleRow
              label={t('settings.pullToRefresh')}
              icon="refresh"
              value={settings.pullToRefreshEnabled}
              onPress={() => settings$.pullToRefreshEnabled.set(!settings.pullToRefreshEnabled)}
            />,
          )}
          <SettingsToggleRow
            label={t('settings.channelsFeed')}
            icon="rss-feed"
            value={settings.feedsEnabled}
            onPress={() => settings$.feedsEnabled.set(!settings.feedsEnabled)}
          />
          <SettingsToggleRow
            label={t('settings.watchHistory')}
            icon="history"
            value={settings.keepHistory}
            onPress={() => settings$.keepHistory.set(!settings.keepHistory)}
            isLast
          />
        </View>
      </SettingsSection>

      <View className="mt-8">
        <SettingsSection label={t('settings.preferencesContent')}>
          <View className={surfaceCls}>
            <SettingsToggleRow
              label={t('settings.hideShorts')}
              icon="movie-filter"
              value={settings.hideShorts}
              onPress={() => settings$.hideShorts.set(!settings.hideShorts)}
            />
            <SettingsToggleRow
              label="Sponsor block"
              icon="block"
              value={settings.sponsorBlock}
              onPress={() => settings$.sponsorBlock.set(!settings.sponsorBlock)}
            />
            <View className="flex-row items-center gap-3 px-4 py-4">
              <View className={iconWrapCls}>
                <MaterialIcons name="image" color={isDark ? '#d4d4d8' : '#475569'} size={18} />
              </View>
              <View className="flex-1">
                <NouText className="font-medium">{t('settings.clickbaitThumbnail.label')}</NouText>
                <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                  {t('settings.clickbaitThumbnail.hint')}
                </NouText>
              </View>
              <NouMenu
                trigger={
                  isWeb ? (
                    <NouButton size="1" variant="outline" onPress={() => {}}>
                      {clickbaitLabel(settings.clickbaitThumbnail)}
                    </NouButton>
                  ) : (
                    'ellipsis'
                  )
                }
                items={clickbaitMenuItems}
              />
            </View>
          </View>
        </SettingsSection>
      </View>

      <View className="mt-8">
        <SettingsSection label={t('settings.preferencesPlayback')}>
          <View className={surfaceCls}>
            <SettingsToggleRow
              label={t('settings.preferH264')}
              icon="hd"
              value={settings.preferH264}
              onPress={() => settings$.preferH264.set(!settings.preferH264)}
            />
            {isAndroid ? (
              <SettingsToggleRow
                label={t('settings.miniPlayer')}
                icon="picture-in-picture-alt"
                value={settings.miniPlayer}
                onPress={() => settings$.miniPlayer.set(!settings.miniPlayer)}
              />
            ) : null}
            <SettingsToggleRow
              label={t('settings.showOriginalVideoTitle')}
              icon="translate"
              value={settings.showOriginalVideoTitle}
              onPress={() => settings$.showOriginalVideoTitle.set(!settings.showOriginalVideoTitle)}
            />
            <SettingsToggleRow
              label={t('settings.showDislikes')}
              icon="thumb-down"
              value={settings.showDislikes}
              onPress={() => settings$.showDislikes.set(!settings.showDislikes)}
              isLast
            />
          </View>
        </SettingsSection>
      </View>

      {nIf(
        !isWeb,
        <View className="mt-8">
          <SettingsSection label={t('settings.proxy.label')}>
            <View className={surfaceCls}>
              <SettingsToggleRow
                label={t('settings.proxy.enabled')}
                icon="settings-ethernet"
                value={settings.proxyEnabled}
                onPress={() => settings$.proxyEnabled.set(!settings.proxyEnabled)}
                isLast={!settings.proxyEnabled}
              />
              {nIf(
                settings.proxyEnabled,
                <>
                  <View className="flex-row items-center justify-between gap-3 border-b border-zinc-300 px-4 py-4 dark:border-zinc-800">
                    <NouText className="font-medium">{t('settings.proxy.type')}</NouText>
                    <Segmented
                      options={['HTTP', 'SOCKS']}
                      selectedIndex={settings.proxyType === 'socks' ? 1 : 0}
                      size={1}
                      onChange={(index) => settings$.proxyType.set(index === 1 ? 'socks' : 'http')}
                    />
                  </View>
                  <View className="flex-row items-center justify-between gap-3 border-b border-zinc-300 px-4 py-4 dark:border-zinc-800">
                    <NouText className="w-24 font-medium">{t('settings.proxy.host')}</NouText>
                    <TextInput
                      className="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-right text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      value={settings.proxyHost}
                      onChangeText={(text) => settings$.proxyHost.set(text)}
                      placeholder={t('settings.proxy.hostPlaceholder')}
                      placeholderTextColor="#71717a"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View className="flex-row items-center justify-between gap-3 px-4 py-4">
                    <NouText className="w-24 font-medium">{t('settings.proxy.port')}</NouText>
                    <TextInput
                      className="w-32 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-right text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      value={settings.proxyPort}
                      onChangeText={(text) => settings$.proxyPort.set(text)}
                      placeholder={t('settings.proxy.portPlaceholder')}
                      placeholderTextColor="#71717a"
                      keyboardType="numeric"
                      returnKeyType="done"
                    />
                  </View>
                </>,
              )}
            </View>
          </SettingsSection>
        </View>,
      )}
    </View>
  )
}

export const SettingsAppearanceContent = () => {
  const settings = useValue(settings$)
  const theme = settings.theme
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const locales = useLocales()
  const systemLanguage = resolveI18nLanguageFromExpoLocale(locales[0]) || 'en'
  const effectiveLanguage = settings.language || systemLanguage
  const isSystemLanguageSelected = settings.language == null
  const toLanguageLabel = (code: string) =>
    i18nLanguageNativeNames[code as keyof typeof i18nLanguageNativeNames] || code
  const currentLanguageLabel = settings.language
    ? toLanguageLabel(settings.language)
    : `${t('settings.language.system')} (${toLanguageLabel(effectiveLanguage)})`
  const languageMenuItems = [
    {
      label: `${t('settings.language.system')} (${toLanguageLabel(systemLanguage)})`,
      handler: () => settings$.setLanguage(null),
      metaLabel: isSystemLanguageSelected ? '✓' : undefined,
    },
    ...supportedI18nLanguages.map((language) => ({
      label: toLanguageLabel(language),
      handler: () => settings$.setLanguage(language),
      metaLabel: settings.language === language ? '✓' : undefined,
    })),
  ]

  return (
    <View className="pb-4">
      {!isWeb ? (
        <SettingsSection label={t('settings.appearance.toolbar')}>
          <View className={surfaceCls}>
            <View className="flex-row items-center gap-3 px-4 py-4 border-b border-zinc-300 dark:border-zinc-800">
              <View className={iconWrapCls}>
                <MaterialIcons name="vertical-align-bottom" color={isDark ? '#d4d4d8' : '#475569'} size={18} />
              </View>
              <NouText className="flex-1 font-medium">{t('settings.headerPosition.label')}</NouText>
              <Segmented
                options={[t('settings.headerPosition.top'), t('settings.headerPosition.bottom')]}
                selectedIndex={headerPositions.indexOf(settings.headerPosition)}
                size={1}
                onChange={(index) => settings$.headerPosition.set(headerPositions[index])}
              />
            </View>
            <SettingsToggleRow
              label={t('settings.autoHideHeader')}
              icon="visibility-off"
              value={settings.autoHideHeader}
              onPress={() => settings$.autoHideHeader.set(!settings.autoHideHeader)}
            />
            <SettingsToggleRow
              label={t('settings.hideToolbarWhenScrolled')}
              icon="vertical-align-top"
              value={settings.hideToolbarWhenScrolled}
              onPress={() => settings$.hideToolbarWhenScrolled.set(!settings.hideToolbarWhenScrolled)}
            />
            <SettingsToggleRow
              label={t('settings.showHomeButtonInHeader')}
              icon="home"
              value={settings.showHomeButtonInHeader}
              onPress={() => settings$.showHomeButtonInHeader.set(!settings.showHomeButtonInHeader)}
            />
            <SettingsToggleRow
              label={t('settings.showBackButtonInHeader')}
              icon="arrow-back"
              value={settings.showBackButtonInHeader}
              onPress={() => settings$.showBackButtonInHeader.set(!settings.showBackButtonInHeader)}
            />
            <SettingsToggleRow
              label={t('settings.showForwardButtonInHeader')}
              icon="arrow-forward"
              value={settings.showForwardButtonInHeader}
              onPress={() => settings$.showForwardButtonInHeader.set(!settings.showForwardButtonInHeader)}
            />
            <SettingsToggleRow
              label={t('settings.showReloadButtonInHeader')}
              icon="refresh"
              value={settings.showReloadButtonInHeader}
              onPress={() => settings$.showReloadButtonInHeader.set(!settings.showReloadButtonInHeader)}
              isLast
            />
          </View>
        </SettingsSection>
      ) : null}

      <View className={!isWeb ? 'mt-8' : undefined}>
        <SettingsSection label={t('settings.preferences')}>
          <View className={surfaceCls}>
            <SettingsToggleRow
              label="Show playback speed control"
              icon="speed"
              value={settings.showPlaybackSpeedControl}
              onPress={() => settings$.showPlaybackSpeedControl.set(!settings.showPlaybackSpeedControl)}
            />
            <SettingsToggleRow
              label="Show video quality control"
              icon="high-quality"
              value={settings.showPlaybackQualityControl}
              onPress={() => settings$.showPlaybackQualityControl.set(!settings.showPlaybackQualityControl)}
              isLast={!isWeb}
            />
            {nIf(
              isWeb,
              <SettingsToggleRow
                label={t('settings.autoHideSidebar')}
                icon="vertical-split"
                value={settings.autoHideSidebar}
                onPress={() => settings$.autoHideSidebar.set(!settings.autoHideSidebar)}
                isLast
              />,
            )}
          </View>
        </SettingsSection>
      </View>

      {nIf(
        isAndroid,
        <View className="mt-8">
          <SettingsSection label={t('settings.zoom.label')}>
            <View className={surfaceCls}>
              <View className="flex-row items-center gap-3 px-4 py-4">
                <View className={iconWrapCls}>
                  <MaterialIcons name="zoom-in" color={isDark ? '#d4d4d8' : '#475569'} size={18} />
                </View>
                <View className="flex-1">
                  <NouText className="font-medium">{t('settings.zoom.defaultLabel')}</NouText>
                  <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                    {t('settings.zoom.defaultHint')}
                  </NouText>
                </View>
                <NouMenu
                  trigger={
                    <NouButton size="1" variant="outline" onPress={() => {}}>
                      {settings.defaultZoom}%
                    </NouButton>
                  }
                  items={ZOOM_PRESETS.map((zoom) => ({
                    label: `${zoom}%`,
                    handler: () => settings$.defaultZoom.set(zoom),
                    metaLabel: settings.defaultZoom === zoom ? '✓' : undefined,
                  }))}
                />
              </View>
            </View>
          </SettingsSection>
        </View>,
      )}

      <View className="mt-8">
        <SettingsSection label={t('settings.language.label')}>
          <View className={surfaceCls}>
            <View className="flex-row items-center justify-between gap-3 px-4 py-4">
              <View className={iconWrapCls}>
                <MaterialIcons name="translate" color={isDark ? '#d4d4d8' : '#475569'} size={18} />
              </View>
              <View className="flex-1">
                <NouText className="font-medium">{t('settings.language.label')}</NouText>
                <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                  {t('settings.language.hint')}
                </NouText>
              </View>
              <NouMenu
                trigger={
                  isWeb ? (
                    <NouButton size="1" variant="outline" textClassName="max-w-48 truncate" onPress={() => {}}>
                      {currentLanguageLabel}
                    </NouButton>
                  ) : (
                    'ellipsis'
                  )
                }
                items={languageMenuItems}
              />
            </View>
          </View>
        </SettingsSection>
      </View>

      <View className="mt-8">
        <SettingsSection label={t('settings.theme.label')}>
          <View className={surfaceCls}>
            <View className="px-4 py-4">
              <View className="flex-row items-start gap-3">
                <View className={iconWrapCls}>
                  <MaterialIcons name="palette" color={isDark ? '#d4d4d8' : '#475569'} size={18} />
                </View>
                <View className="flex-1">
                  <NouText className="font-medium">{t('settings.theme.label')}</NouText>
                  <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                    {t('settings.theme.hint')}
                  </NouText>
                </View>
              </View>
            </View>
            <View className="border-t border-zinc-300 dark:border-zinc-800 px-4 py-4">
              <View className="items-end">
                <Segmented
                  options={[t('settings.theme.system'), t('settings.theme.dark'), t('settings.theme.light')]}
                  selectedIndex={themes.indexOf(theme)}
                  size={1}
                  onChange={(index) => settings$.theme.set(themes[index])}
                />
              </View>
            </View>
          </View>
        </SettingsSection>
      </View>
    </View>
  )
}

export const SettingsToolsContent = () => {
  const sleepTimerSupported = hasSleepTimerNativeSupport()
  const { active, remainingMs } = useSleepTimerStatus(sleepTimerSupported)
  const [updatingYtDlp, setUpdatingYtDlp] = useState(false)

  const clearWebviewData = () => {
    showConfirm('Clear webview data', 'All cookies, browsing history will be removed.', () => {
      onClearData$.fire()
      showToast('WebView data cleared')
    })
  }

  const handleUpdateYtDlp = async () => {
    setUpdatingYtDlp(true)
    try {
      await mainClient.updateYtDlp()
      showToast(t('buttons.ytDlpUpdated'))
    } catch (e: any) {
      console.error('updateYtDlp failed', e)
      showToast(e.message || 'Failed to update yt-dlp')
    } finally {
      setUpdatingYtDlp(false)
    }
  }

  return (
    <SettingsSection label={t('settings.tools')}>
      <View className={surfaceCls}>
        {sleepTimerSupported ? (
          <SettingsActionRow
            label={t('sleepTimer.label')}
            description={
              active ? t('sleepTimer.endsIn', { value: formatSleepTimerRemaining(remainingMs) }) : t('sleepTimer.off')
            }
            icon="bedtime"
            onPress={() => ui$.sleepTimerModalOpen.set(true)}
          />
        ) : null}
        <SettingsActionRow
          label={t('settings.webview.clearLabel')}
          description="Cookies and browsing state"
          icon="delete-sweep"
          onPress={clearWebviewData}
        />
        <SettingsActionRow
          label={t('settings.injectCookie')}
          description={t('settings.injectCookieHint')}
          icon="vpn-key"
          onPress={() => ui$.cookieModalOpen.set(true)}
        />
        <SettingsActionRow
          label={t('settings.userAgent.title')}
          description={t('settings.userAgent.default')}
          icon="devices"
          onPress={() => ui$.userAgentModalOpen.set(true)}
        />
        <SettingsActionRow
          label={t('buttons.updateYtDlp')}
          description="Download the latest version from GitHub"
          icon="download-for-offline"
          onPress={handleUpdateYtDlp}
          loading={updatingYtDlp}
          isLast
        />
      </View>
    </SettingsSection>
  )
}

export const SettingsTransferContent: React.FC<{
  importingList: boolean
  setImportingList: React.Dispatch<React.SetStateAction<boolean>>
  importingTakeout: boolean
  setImportingTakeout: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ importingList, setImportingList, importingTakeout, setImportingTakeout }) => {
  const isImporting = importingList || importingTakeout

  const onClickImportList = async () => {
    if (isImporting) {
      return
    }
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: 'text/*' })
    setImportingList(true)
    try {
      const csv = res.assets?.[0]
      if (csv) {
        const response = await fetch(csv.uri)
        const text = await response.text()
        await importList(text)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setImportingList(false)
    }
  }

  const onClickExportList = async () => {
    const content = bookmarks$.bookmarks
      .get()
      .map((x) => x.url)
      .join('\n')
    const filename = `NouTube_bookmarks_${Date.now()}.txt`
    await saveFile(filename, content)
  }

  const onClickImportTakeout = async () => {
    if (isImporting) {
      return
    }
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: ['application/zip', 'text/*'] })
    setImportingTakeout(true)
    try {
      const asset = res.assets?.[0]
      if (asset) {
        const isZip =
          asset.mimeType === 'application/zip' ||
          asset.mimeType === 'application/x-zip-compressed' ||
          asset.name?.toLowerCase().endsWith('.zip')

        if (isZip) {
          if (Platform.OS === 'android') {
            const files = await NouTubeViewModule.extractTakeoutCsvFiles(asset.uri)
            let total = 0
            for (const file of files) {
              const response = await fetch(file.uri)
              const text = await response.text()
              total += await importCsv(text, file.name)
            }
            if (total === 0) {
              showToast("Nothing recognized in zip — make sure it's a YouTube Takeout export")
            }
          } else {
            const response = await fetch(asset.uri)
            const data = await response.arrayBuffer()
            const zip = new JSZip()
            await zip.loadAsync(data)
            await importZip(zip)
          }
        } else {
          const response = await fetch(asset.uri)
          const text = await response.text()
          const count = await importCsv(text, asset.name)
          if (count === 0) {
            showToast(`Unrecognized CSV: ${asset.name}`)
          }
        }
      }
    } catch (e) {
      console.error(e)
      showToast('Import failed: ' + (e as Error).message)
    } finally {
      setImportingTakeout(false)
    }
  }

  return (
    <View className="gap-6">
      <SettingsSection label={t('buttons.import')}>
        <View className={surfaceCls}>
          <SettingsActionRow
            label={t('settings.importList')}
            description="Plain text or copied links"
            icon="playlist-add"
            onPress={() => {
              void onClickImportList()
            }}
            loading={importingList}
            disabled={isImporting}
          />
          <SettingsActionRow
            label={t('settings.importTakeout')}
            description="Google Takeout zip or CSV"
            icon="archive"
            onPress={() => {
              void onClickImportTakeout()
            }}
            loading={importingTakeout}
            disabled={isImporting}
            isLast
          />
        </View>
      </SettingsSection>

      {!isWeb ? (
        <SettingsSection label={t('buttons.export')}>
          <View className={surfaceCls}>
            <SettingsActionRow
              label={t('settings.exportLabel')}
              description="Save starred links as a plain text list"
              icon="upload-file"
              onPress={() => {
                void onClickExportList()
              }}
              isLast
            />
          </View>
        </SettingsSection>
      ) : null}
    </View>
  )
}
