import { useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { getDocumentAsync } from 'expo-document-picker'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import { BaseFullScreenModal } from './BaseFullScreenModal'
import { NouText } from '../NouText'
import { clsx, isWeb, nIf } from '@/lib/utils'
import {
  buildUserScriptExecutionSource,
  parseUserscriptMetadata,
  stripUserscriptMetadata,
  type CustomUserScript,
  type CustomUserStyle,
  type UserScriptRunAt,
} from '@/lib/user-styles'
import { useKeyboardHeight } from '@/lib/hooks/useKeyboardHeight'
import { userStyles$ } from '@/states/user-styles'
import { ui$ } from '@/states/ui'
import { showToast } from '@/lib/toast'
import { NouButton } from '../button/NouButton'
import { MaterialButton } from '../button/IconButtons'

const surfaceCls =
  'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
const subheaderCls = 'mb-3 text-xs uppercase tracking-[0.18em] text-zinc-600 dark:text-gray-500'
const rowCls = 'px-4 py-4'
const rowBorderCls = 'border-b border-zinc-300 dark:border-zinc-800'
const textInputCls =
  'rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 px-4 py-4 text-zinc-900 dark:text-white'
// The full screen editors trade the labelled, roomy fields of the sidebar for a
// single compact name row, so the code area keeps the rest of the screen.
const nameInputCls =
  'rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-white'
const editorLabelCls = 'mb-2 mt-4 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500'

const switchProps = Platform.select({
  web: { activeThumbColor: '#818cf8' },
  ios: { style: { transform: [{ scale: 0.8 }] } },
})

const runAtOf = (early: boolean): UserScriptRunAt => (early ? 'document-start' : 'document-end')

const ToggleRow: React.FC<{
  title: string
  hint: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  isLast?: boolean
}> = ({ title, hint, value, onValueChange, disabled, isLast }) => (
  <View
    className={clsx('flex-row items-center justify-between px-4 py-3', !isLast && rowBorderCls, disabled && 'opacity-50')}
  >
    <View className="flex-1 pr-4">
      <NouText className="font-medium">{title}</NouText>
      <NouText className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">{hint}</NouText>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: '#27272a', true: '#3730a3' }}
      thumbColor={value ? '#818cf8' : '#71717a'}
      {...switchProps}
    />
  </View>
)

type DraftState = {
  id: string | null
  name: string
  enabled: boolean
  css: string
}

const createDraft = (style?: CustomUserStyle | null): DraftState => {
  if (!style) {
    return {
      id: null,
      name: '',
      enabled: true,
      css: '',
    }
  }

  return {
    id: style.id,
    name: style.name,
    enabled: style.enabled,
    css: style.css,
  }
}

async function readPickedCss() {
  const result = await getDocumentAsync({
    type: ['text/css', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (result.canceled || !result.assets?.[0]) {
    return ''
  }

  const response = await fetch(result.assets[0].uri)
  return response.text()
}

type ScriptDraftState = {
  id: string | null
  name: string
  enabled: boolean
  pinToHeader: boolean
  runAt: UserScriptRunAt
  js: string
}

const createScriptDraft = (script?: CustomUserScript | null): ScriptDraftState => {
  if (!script) {
    return {
      id: null,
      name: '',
      enabled: true,
      pinToHeader: false,
      runAt: 'document-end',
      js: '',
    }
  }

  return {
    id: script.id,
    name: script.name,
    enabled: script.enabled,
    pinToHeader: script.pinToHeader,
    runAt: script.runAt,
    js: script.js,
  }
}

async function readPickedScript() {
  const result = await getDocumentAsync({
    type: ['text/javascript', 'application/javascript', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (result.canceled || !result.assets?.[0]) {
    return ''
  }

  const response = await fetch(result.assets[0].uri)
  return response.text()
}

export const SettingsUserStylesContent = () => {
  const customStyles = useValue(userStyles$.customStyles)
  const customScripts = useValue(userStyles$.customScripts).filter((script): script is CustomUserScript => Boolean(script))
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [scriptDraft, setScriptDraft] = useState<ScriptDraftState | null>(null)
  // While the code editor has focus the name and toggles are just chrome in the
  // way, so they fold away and the editor rises to sit right under the header.
  const [codeFocused, setCodeFocused] = useState(false)
  const keyboardHeight = useKeyboardHeight()
  const codeExpanded = codeFocused && keyboardHeight > 0
  const hasStyles = customStyles.length > 0
  const hasScripts = customScripts.length > 0

  const closeDraft = () => {
    setCodeFocused(false)
    setDraft(null)
  }
  const closeScriptDraft = () => {
    setCodeFocused(false)
    setScriptDraft(null)
  }

  const onImportScript = async () => {
    try {
      const source = await readPickedScript()
      if (!source) {
        return
      }
      const metadata = parseUserscriptMetadata(source)
      const js = stripUserscriptMetadata(source) || source
      setScriptDraft((value) =>
        value ? { ...value, name: value.name || metadata.name, runAt: metadata.runAt, js } : value,
      )
    } catch (error) {
      console.warn('[SettingsUserStylesContent] failed to import script', error)
      showToast(t('settings.userStyles.scripts.importFailed'))
    }
  }

  const onRunScript = () => {
    if (!scriptDraft?.js.trim()) {
      showToast(t('settings.userStyles.scripts.validation.js'))
      return
    }

    const webview = ui$.webview.get()
    if (!webview) {
      showToast(t('settings.userStyles.scripts.noActiveTab'))
      return
    }

    const wrapped = buildUserScriptExecutionSource(scriptDraft)
    Promise.resolve(webview.executeJavaScript(wrapped))
      .then(() => showToast(t('settings.userStyles.scripts.runComplete')))
      .catch(() => showToast(t('settings.userStyles.scripts.runFailed')))
  }

  const onSaveScript = () => {
    if (!scriptDraft) {
      return
    }

    if (!scriptDraft.js.trim()) {
      showToast(t('settings.userStyles.scripts.validation.js'))
      return
    }

    const input = {
      name: scriptDraft.name.trim(),
      enabled: scriptDraft.enabled,
      pinToHeader: scriptDraft.pinToHeader,
      runAt: scriptDraft.runAt,
      js: scriptDraft.js,
    }

    if (scriptDraft.id) {
      userStyles$.updateCustomScript(scriptDraft.id, input)
    } else {
      userStyles$.addCustomScript(input)
    }

    closeScriptDraft()
  }

  const onImportCss = async () => {
    try {
      const css = await readPickedCss()
      if (!css) {
        return
      }
      setDraft((value) => (value ? { ...value, css } : value))
    } catch (error) {
      console.warn('[SettingsUserStylesContent] failed to import css', error)
      showToast(t('settings.userStyles.importFailed'))
    }
  }

  const onSave = () => {
    if (!draft) {
      return
    }

    if (!draft.css.trim()) {
      showToast(t('settings.userStyles.validation.css'))
      return
    }

    const input = {
      name: draft.name.trim(),
      enabled: draft.enabled,
      css: draft.css,
    }

    if (draft.id) {
      userStyles$.updateCustomStyle(draft.id, input)
    } else {
      userStyles$.addCustomStyle(input)
    }

    closeDraft()
  }

  return (
    <View className="pb-4">
      {isWeb && (draft || scriptDraft) ? null : (
        <>
          <View>
            <View className="mb-3 flex-row items-center justify-between">
              <NouText className={subheaderCls}>{t('settings.userStyles.custom.label')}</NouText>
              <Pressable
                onPress={() => setDraft(createDraft())}
                className="flex-row items-center gap-1 rounded-full bg-indigo-600/10 px-3 py-1.5 active:bg-indigo-600/20"
              >
                <MaterialIcons name="add" color="#818cf8" size={18} />
                <NouText className="text-xs font-semibold text-indigo-400">{t('settings.userStyles.add')}</NouText>
              </Pressable>
            </View>
            <View className={surfaceCls}>
              {!hasStyles ? (
                <View className="items-center justify-center px-6 py-10">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-zinc-200 dark:bg-zinc-950">
                    <MaterialIcons name="brush" color="#3f3f46" size={24} />
                  </View>
                  <NouText className="mt-4 text-center text-sm leading-6 text-zinc-600 dark:text-zinc-500">
                    {t('settings.userStyles.custom.empty')}
                  </NouText>
                </View>
              ) : null}
              {customStyles.map((style, index) => (
                <Pressable
                  key={style.id}
                  onPress={() => setDraft(createDraft(style))}
                  className={clsx(
                    rowCls,
                    'flex-row items-center justify-between active:bg-zinc-200/50 dark:active:bg-zinc-800/50',
                    index !== customStyles.length - 1 && rowBorderCls,
                  )}
                >
                  <View className="flex-1 pr-4">
                    <NouText className={clsx('font-medium', !style.enabled && 'text-zinc-500')} numberOfLines={1}>
                      {style.name}
                    </NouText>
                  </View>
                  <Switch
                    value={style.enabled}
                    onValueChange={() => userStyles$.toggleCustomStyle(style.id)}
                    trackColor={{ false: '#27272a', true: '#3730a3' }}
                    thumbColor={style.enabled ? '#818cf8' : '#71717a'}
                    {...Platform.select({
                      web: {
                        activeThumbColor: '#818cf8',
                      },
                      ios: {
                        style: { transform: [{ scale: 0.8 }] },
                      },
                    })}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-10">
            <View className="mb-3 flex-row items-center justify-between">
              <NouText className={subheaderCls}>{t('settings.userStyles.scripts.label')}</NouText>
              <Pressable
                onPress={() => setScriptDraft(createScriptDraft())}
                className="flex-row items-center gap-1 rounded-full bg-indigo-600/10 px-3 py-1.5 active:bg-indigo-600/20"
              >
                <MaterialIcons name="add" color="#818cf8" size={18} />
                <NouText className="text-xs font-semibold text-indigo-400">{t('settings.userStyles.scripts.add')}</NouText>
              </Pressable>
            </View>
            <View className={surfaceCls}>
              {!hasScripts ? (
                <View className="items-center justify-center px-6 py-10">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-zinc-200 dark:bg-zinc-950">
                    <MaterialIcons name="code" color="#3f3f46" size={24} />
                  </View>
                  <NouText className="mt-4 text-center text-sm leading-6 text-zinc-600 dark:text-zinc-500">
                    {t('settings.userStyles.scripts.empty')}
                  </NouText>
                </View>
              ) : null}
              {customScripts.map((script, index) => (
                <Pressable
                  key={script.id}
                  onPress={() => setScriptDraft(createScriptDraft(script))}
                  className={clsx(
                    rowCls,
                    'flex-row items-center justify-between active:bg-zinc-200/50 dark:active:bg-zinc-800/50',
                    index !== customScripts.length - 1 && rowBorderCls,
                  )}
                >
                  <View className="flex-1 pr-4">
                    <NouText className={clsx('font-medium', !script.enabled && 'text-zinc-500')} numberOfLines={1}>
                      {script.name}
                    </NouText>
                    {nIf(
                      script.runAt === 'document-start',
                      <NouText className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
                        {t('settings.userStyles.scripts.runAtStartBadge')}
                      </NouText>,
                    )}
                  </View>
                  {nIf(
                    script.pinToHeader,
                    <MaterialIcons
                      name="push-pin"
                      color={script.enabled ? '#818cf8' : '#71717a'}
                      size={18}
                      style={{ marginRight: 12 }}
                    />,
                  )}
                  <Switch
                    value={script.enabled}
                    onValueChange={() => userStyles$.toggleCustomScript(script.id)}
                    trackColor={{ false: '#27272a', true: '#3730a3' }}
                    thumbColor={script.enabled ? '#818cf8' : '#71717a'}
                    {...Platform.select({
                      web: {
                        activeThumbColor: '#818cf8',
                      },
                      ios: {
                        style: { transform: [{ scale: 0.8 }] },
                      },
                    })}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {draft ? (
        isWeb ? (
          <View className="pb-4">
            <View>
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10">
                  <MaterialIcons name="auto-fix-high" color="#818cf8" size={20} />
                </View>
                <NouText className="text-xl font-bold tracking-tight">
                  {draft.id ? t('settings.userStyles.editTitle') : t('settings.userStyles.addTitle')}
                </NouText>
              </View>

              <View className="mt-8">
                <NouText className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                  {t('settings.userStyles.nameLabel')}
                </NouText>
                <TextInput
                  className={textInputCls}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(name) => setDraft((value) => (value ? { ...value, name } : value))}
                  placeholder={t('settings.userStyles.namePlaceholder')}
                  placeholderTextColor="#71717a"
                  value={draft.name}
                />
              </View>

              <View className="mt-6">
                <NouText className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                  CSS
                </NouText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                >
                  <TextInput
                    className="min-h-[300px] p-4 text-xs text-zinc-900 dark:text-white"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    onChangeText={(css) => setDraft((value) => (value ? { ...value, css } : value))}
                    placeholder={`body {\n  font-size: 18px;\n}`}
                    placeholderTextColor="#71717a"
                    style={{
                      textAlignVertical: 'top',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      minWidth: 800,
                    }}
                    value={draft.css}
                  />
                </ScrollView>
              </View>

              <View className="mt-10 flex-row items-center justify-between gap-4">
                <View className="flex-row items-center gap-2">
                  <NouButton variant="outline" size="1" onPress={closeDraft}>
                    {t('buttons.cancel')}
                  </NouButton>
                  <MaterialButton name="folder-open" size={20} onPress={onImportCss} />
                  {draft.id ? (
                    <MaterialButton
                      name="delete-outline"
                      size={20}
                      color="#ef4444"
                      onPress={() => {
                        Alert.alert(t('menus.remove'), t('settings.userStyles.deleteConfirm'), [
                          { text: t('buttons.cancel'), style: 'cancel' },
                          {
                            text: t('buttons.remove'),
                            style: 'destructive',
                            onPress: () => {
                              userStyles$.deleteCustomStyle(draft.id!)
                              closeDraft()
                            },
                          },
                        ])
                      }}
                    />
                  ) : null}
                </View>
                <NouButton onPress={onSave}>{t('buttons.save')}</NouButton>
              </View>
            </View>
          </View>
        ) : (
          <BaseFullScreenModal
            title={draft.id ? t('settings.userStyles.editTitle') : t('settings.userStyles.addTitle')}
            icon="auto-fix-high"
            onClose={closeDraft}
            actions={
              <>
                <MaterialButton name="folder-open" size={20} onPress={onImportCss} />
                {draft.id ? (
                  <MaterialButton
                    name="delete-outline"
                    size={20}
                    color="#ef4444"
                    onPress={() => {
                      Alert.alert(t('menus.remove'), t('settings.userStyles.deleteConfirm'), [
                        { text: t('buttons.cancel'), style: 'cancel' },
                        {
                          text: t('buttons.remove'),
                          style: 'destructive',
                          onPress: () => {
                            userStyles$.deleteCustomStyle(draft.id!)
                            closeDraft()
                          },
                        },
                      ])
                    }}
                  />
                ) : null}
                <NouButton size="1" onPress={onSave}>
                  {t('buttons.save')}
                </NouButton>
              </>
            }
          >
            <View className="flex-1 px-4 pb-4 pt-4">
              {nIf(
                !codeExpanded,
                <TextInput
                  className={nameInputCls}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(name) => setDraft((value) => (value ? { ...value, name } : value))}
                  placeholder={t('settings.userStyles.namePlaceholder')}
                  placeholderTextColor="#71717a"
                  value={draft.name}
                />,
              )}

              <NouText className={clsx(editorLabelCls, codeExpanded && 'mt-0')}>CSS</NouText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-1 rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  className="flex-1 p-4 text-xs text-zinc-900 dark:text-white"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  onChangeText={(css) => setDraft((value) => (value ? { ...value, css } : value))}
                  placeholder={`body {\n  font-size: 18px;\n}`}
                  placeholderTextColor="#71717a"
                  style={{
                    textAlignVertical: 'top',
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    minWidth: 800,
                  }}
                  value={draft.css}
                />
              </ScrollView>
            </View>
          </BaseFullScreenModal>
        )
      ) : null}

      {scriptDraft ? (
        isWeb ? (
          <View className="pb-4">
            <View>
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10">
                  <MaterialIcons name="code" color="#818cf8" size={20} />
                </View>
                <NouText className="text-xl font-bold tracking-tight">
                  {scriptDraft.id ? t('settings.userStyles.scripts.editTitle') : t('settings.userStyles.scripts.addTitle')}
                </NouText>
              </View>

              <View className="mt-8">
                <NouText className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                  {t('settings.userStyles.nameLabel')}
                </NouText>
                <TextInput
                  className={textInputCls}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(name) => setScriptDraft((value) => (value ? { ...value, name } : value))}
                  placeholder={t('settings.userStyles.scripts.namePlaceholder')}
                  placeholderTextColor="#71717a"
                  value={scriptDraft.name}
                />
              </View>

              <View className="mt-6 overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                <ToggleRow
                  title={t('settings.userStyles.scripts.pinToHeader')}
                  hint={t('settings.userStyles.scripts.pinToHeaderHint')}
                  value={scriptDraft.pinToHeader}
                  onValueChange={(pinToHeader) => setScriptDraft((value) => (value ? { ...value, pinToHeader } : value))}
                />
                <ToggleRow
                  title={t('settings.userStyles.scripts.runAtStart')}
                  // The desktop webview only gets the content script on dom-ready, so
                  // there is no earlier slot to offer yet.
                  hint={t('settings.userStyles.scripts.runAtStartDesktopHint')}
                  value={scriptDraft.runAt === 'document-start'}
                  onValueChange={(early) => setScriptDraft((value) => (value ? { ...value, runAt: runAtOf(early) } : value))}
                  disabled
                  isLast
                />
              </View>

              <View className="mt-6">
                <View className="mb-2 flex-row items-center justify-between px-1">
                  <NouText className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                    JavaScript
                  </NouText>
                  <Pressable
                    onPress={onRunScript}
                    className="h-8 flex-row items-center gap-1.5 rounded-lg bg-indigo-600 px-3 active:bg-indigo-700"
                  >
                    <MaterialIcons name="play-arrow" color="white" size={16} />
                    <NouText className="text-xs font-semibold" style={{ color: 'white' }}>
                      {t('settings.userStyles.scripts.run')}
                    </NouText>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                >
                  <TextInput
                    className="p-4 text-xs text-zinc-900 dark:text-white"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    scrollEnabled
                    onChangeText={(js) => setScriptDraft((value) => (value ? { ...value, js } : value))}
                    placeholder={`document.title = 'noutube'`}
                    placeholderTextColor="#71717a"
                    style={{
                      height: 300,
                      textAlignVertical: 'top',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      minWidth: 800,
                    }}
                    value={scriptDraft.js}
                  />
                </ScrollView>
              </View>

              <View className="mt-10 flex-row items-center justify-between gap-4">
                <View className="flex-row items-center gap-2">
                  <NouButton variant="outline" size="1" onPress={closeScriptDraft}>
                    {t('buttons.cancel')}
                  </NouButton>
                  <MaterialButton name="folder-open" size={20} onPress={onImportScript} />
                  {scriptDraft.id ? (
                    <MaterialButton
                      name="delete-outline"
                      size={20}
                      color="#ef4444"
                      onPress={() => {
                        Alert.alert(t('menus.remove'), t('settings.userStyles.scripts.deleteConfirm'), [
                          { text: t('buttons.cancel'), style: 'cancel' },
                          {
                            text: t('buttons.remove'),
                            style: 'destructive',
                            onPress: () => {
                              userStyles$.deleteCustomScript(scriptDraft.id!)
                              closeScriptDraft()
                            },
                          },
                        ])
                      }}
                    />
                  ) : null}
                </View>
                <NouButton onPress={onSaveScript}>{t('buttons.save')}</NouButton>
              </View>
            </View>
          </View>
        ) : (
          <BaseFullScreenModal
            title={scriptDraft.id ? t('settings.userStyles.scripts.editTitle') : t('settings.userStyles.scripts.addTitle')}
            icon="code"
            onClose={closeScriptDraft}
            actions={
              <>
                <MaterialButton name="folder-open" size={20} onPress={onImportScript} />
                {scriptDraft.id ? (
                  <MaterialButton
                    name="delete-outline"
                    size={20}
                    color="#ef4444"
                    onPress={() => {
                      Alert.alert(t('menus.remove'), t('settings.userStyles.scripts.deleteConfirm'), [
                        { text: t('buttons.cancel'), style: 'cancel' },
                        {
                          text: t('buttons.remove'),
                          style: 'destructive',
                          onPress: () => {
                            userStyles$.deleteCustomScript(scriptDraft.id!)
                            closeScriptDraft()
                          },
                        },
                      ])
                    }}
                  />
                ) : null}
                <NouButton size="1" onPress={onSaveScript}>
                  {t('buttons.save')}
                </NouButton>
              </>
            }
          >
            <View className="flex-1 px-4 pb-4 pt-4">
              {nIf(
                !codeExpanded,
                <>
                  <TextInput
                    className={nameInputCls}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(name) => setScriptDraft((value) => (value ? { ...value, name } : value))}
                    placeholder={t('settings.userStyles.scripts.namePlaceholder')}
                    placeholderTextColor="#71717a"
                    value={scriptDraft.name}
                  />

                  <View className="mt-3 overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                    <ToggleRow
                      title={t('settings.userStyles.scripts.pinToHeader')}
                      hint={t('settings.userStyles.scripts.pinToHeaderHint')}
                      value={scriptDraft.pinToHeader}
                      onValueChange={(pinToHeader) =>
                        setScriptDraft((value) => (value ? { ...value, pinToHeader } : value))
                      }
                    />
                    <ToggleRow
                      title={t('settings.userStyles.scripts.runAtStart')}
                      hint={t('settings.userStyles.scripts.runAtStartHint')}
                      value={scriptDraft.runAt === 'document-start'}
                      onValueChange={(early) =>
                        setScriptDraft((value) => (value ? { ...value, runAt: runAtOf(early) } : value))
                      }
                      isLast
                    />
                  </View>
                </>,
              )}

              <View className={clsx('mb-2 flex-row items-center justify-between px-1', !codeExpanded && 'mt-4')}>
                <NouText className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                  JavaScript
                </NouText>
                <Pressable
                  onPress={onRunScript}
                  className="h-8 flex-row items-center gap-1.5 rounded-lg bg-indigo-600 px-3 active:bg-indigo-700"
                >
                  <MaterialIcons name="play-arrow" color="white" size={16} />
                  <NouText className="text-xs font-semibold" style={{ color: 'white' }}>
                    {t('settings.userStyles.scripts.run')}
                  </NouText>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-1 rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  className="flex-1 p-4 text-xs text-zinc-900 dark:text-white"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  scrollEnabled
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  onChangeText={(js) => setScriptDraft((value) => (value ? { ...value, js } : value))}
                  placeholder={`document.title = 'noutube'`}
                  placeholderTextColor="#71717a"
                  style={{
                    textAlignVertical: 'top',
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    minWidth: 800,
                  }}
                  value={scriptDraft.js}
                />
              </ScrollView>
            </View>
          </BaseFullScreenModal>
        )
      ) : null}
    </View>
  )
}
