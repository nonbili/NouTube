import { useMemo, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as Clipboard from 'expo-clipboard'
import { getDocumentAsync } from 'expo-document-picker'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import {
  builtinUserStyleDefinitionById,
  builtinUserStyleDefinitions,
  type BuiltinUserStyleId,
  type CustomUserStyle,
} from '@/lib/user-styles'
import { userStyles$ } from '@/states/user-styles'
import { showToast } from '@/lib/toast'

const surfaceCls = 'overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/70'
const subheaderCls = 'mb-3 text-xs uppercase tracking-[0.18em] text-gray-500'
const rowCls = 'px-4 py-4'
const rowBorderCls = 'border-b border-zinc-800'
const textInputCls = 'rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white'

type DraftState = {
  id: string | null
  name: string
  enabled: boolean
  css: string
}

const cleanCss = (value: string) => {
  const lines = value
    .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '')
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length === 0) {
    return ''
  }

  const firstLineIndent = lines[0].match(/^\s*/)?.[0].length || 0
  return lines.map((line) => line.slice(firstLineIndent)).join('\n')
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

export const SettingsUserStylesContent = () => {
  const customStyles = useValue(userStyles$.customStyles)
  const builtins = useValue(userStyles$.builtins)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [previewBuiltinId, setPreviewBuiltinId] = useState<BuiltinUserStyleId | null>(null)

  const previewDefinition = previewBuiltinId ? builtinUserStyleDefinitionById[previewBuiltinId] : null
  const hasStyles = customStyles.length > 0
  const sortedBuiltins = useMemo(() => builtinUserStyleDefinitions, [])

  const closeDraft = () => setDraft(null)

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

  const onCopyBuiltinCss = async () => {
    if (!previewDefinition) {
      return
    }

    try {
      await Clipboard.setStringAsync(previewDefinition.css.trim())
      showToast(t('settings.userStyles.cssCopied'))
    } catch (error) {
      console.warn('[SettingsUserStylesContent] failed to copy css', error)
      showToast(t('settings.userStyles.copyFailed'))
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
      <View>
        <NouText className={subheaderCls}>{t('settings.userStyles.builtin.label')}</NouText>
        <View className={surfaceCls}>
          {sortedBuiltins.map((definition, index) => (
            <Pressable
              key={definition.id}
              onPress={() => setPreviewBuiltinId(definition.id)}
              className={clsx(
                rowCls,
                'flex-row items-center justify-between active:bg-zinc-800/50',
                index !== sortedBuiltins.length - 1 && rowBorderCls,
              )}
            >
              <View className="flex-1 pr-4">
                <NouText className="font-medium" numberOfLines={1}>
                  {t(definition.labelKey)}
                </NouText>
              </View>
              <Switch
                value={builtins[definition.id]?.enabled ?? true}
                onValueChange={() => userStyles$.toggleBuiltin(definition.id)}
                trackColor={{ false: '#27272a', true: '#3730a3' }}
                thumbColor={(builtins[definition.id]?.enabled ?? true) ? '#818cf8' : '#71717a'}
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
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950">
                <MaterialIcons name="brush" color="#3f3f46" size={24} />
              </View>
              <NouText className="mt-4 text-center text-sm leading-6 text-zinc-500">
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
                'flex-row items-center justify-between active:bg-zinc-800/50',
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

      {draft ? (
        <BaseCenterModal onClose={closeDraft} containerClassName="lg:w-[50rem] xl:w-[60rem] max-w-[95vw]">
          <ScrollView className="max-h-[80vh]">
            <View className="p-6">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10">
                  <MaterialIcons name="auto-fix-high" color="#818cf8" size={20} />
                </View>
                <NouText className="text-xl font-bold tracking-tight">
                  {draft.id ? t('settings.userStyles.editTitle') : t('settings.userStyles.addTitle')}
                </NouText>
              </View>

              <View className="mt-8">
                <NouText className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
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
                <NouText className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">CSS</NouText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="rounded-2xl border border-zinc-800 bg-zinc-950">
                  <TextInput
                    className="min-h-[300px] p-4 text-xs text-white"
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
                  <Pressable onPress={closeDraft} className="rounded-full border border-zinc-800 px-5 py-2.5 active:bg-zinc-900">
                    <NouText className="text-sm font-semibold text-zinc-400">{t('buttons.cancel')}</NouText>
                  </Pressable>
                  <Pressable onPress={onImportCss} className="h-10 w-10 items-center justify-center rounded-full bg-zinc-900 active:bg-zinc-800">
                    <MaterialIcons name="file-upload" color="#a1a1aa" size={20} />
                  </Pressable>
                  {draft.id ? (
                    <Pressable
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
                      className="h-10 w-10 items-center justify-center rounded-full bg-zinc-900 active:bg-red-900/30"
                    >
                      <MaterialIcons name="delete-outline" color="#ef4444" size={20} />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable onPress={onSave} className="rounded-full bg-indigo-600 px-8 py-2.5 active:bg-indigo-700">
                  <NouText className="text-sm font-bold text-white">{t('buttons.save')}</NouText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </BaseCenterModal>
      ) : null}

      {previewDefinition ? (
        <BaseCenterModal
          onClose={() => setPreviewBuiltinId(null)}
          containerClassName="lg:w-[50rem] xl:w-[60rem] max-w-[95vw]"
        >
          <View className="p-6">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-zinc-950">
                <MaterialIcons name="code" color="#818cf8" size={20} />
              </View>
              <View className="flex-1">
                <NouText className="text-lg font-bold">{t(previewDefinition.labelKey)}</NouText>
              </View>
            </View>

            <View className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              <ScrollView className="max-h-[400px]" showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="items-start p-4">
                    <NouText
                      className="font-mono text-[11px] leading-5 text-indigo-300"
                      style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                    >
                      {cleanCss(previewDefinition.css)}
                    </NouText>
                  </View>
                </ScrollView>
              </ScrollView>
            </View>

            <View className="mt-6 flex-row items-center justify-end gap-3">
              <Pressable
                onPress={() => setPreviewBuiltinId(null)}
                className="rounded-full border border-zinc-800 px-6 py-2.5 active:bg-zinc-900"
              >
                <NouText className="text-sm font-semibold text-zinc-400">{t('buttons.cancel')}</NouText>
              </Pressable>
              <Pressable
                onPress={onCopyBuiltinCss}
                className="flex-row items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 active:bg-indigo-700"
              >
                <MaterialIcons name="content-copy" color="white" size={16} />
                <NouText className="text-sm font-bold text-white">{t('settings.userStyles.copyCss')}</NouText>
              </Pressable>
            </View>
          </View>
        </BaseCenterModal>
      ) : null}
    </View>
  )
}
