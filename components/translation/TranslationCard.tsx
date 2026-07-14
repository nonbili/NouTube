import * as Clipboard from 'expo-clipboard'
import { useValue } from '@legendapp/state/react'
import { useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, Dimensions, Pressable, ScrollView, View } from 'react-native'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { t } from 'i18next'
import { translateText } from '@/lib/translation'
import { ui$ } from '@/states/ui'
import { NouText } from '@/components/NouText'
import { nIf } from '@/lib/utils'

export const TranslationCard = () => {
  const request = useValue(ui$.translation)
  const insets = useSafeAreaInsets()
  const [translationState, setTranslationState] = useState<{
    requestId: string
    result: { text: string; sourceLanguage?: string } | null
    error: string | null
  } | null>(null)
  const [pinnedRequestId, setPinnedRequestId] = useState<string | null>(null)

  useEffect(() => {
    if (!request) {
      return
    }
    let cancelled = false
    void translateText(request.text, request.targetLanguage)
      .then((value) => {
        if (!cancelled && ui$.translation.get()?.id === request.id) {
          setTranslationState({ requestId: request.id, result: value, error: null })
        }
      })
      .catch((cause) => {
        if (!cancelled && ui$.translation.get()?.id === request.id) {
          const message = String((cause as Error)?.message || cause)
          setTranslationState({
            requestId: request.id,
            result: null,
            error: message.includes('unavailable')
              ? t('settings.translation.unsupported')
              : t('settings.translation.failed'),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [request])

  useEffect(() => {
    if (!request) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      ui$.translation.set(null)
      return true
    })
    return () => subscription.remove()
  }, [request])

  if (!request) return null
  const result = translationState?.requestId === request.id ? translationState.result : null
  const error = translationState?.requestId === request.id ? translationState.error : null
  const { height, width } = Dimensions.get('window')
  const maxCardHeight = Math.min(360, height - insets.top - insets.bottom - 24)
  const top = Math.min(Math.max(request.y + 8, insets.top + 12), height - insets.bottom - maxCardHeight - 12)
  const left = Math.min(Math.max(request.x, 12), Math.max(12, width - 332))
  const close = () => ui$.translation.set(null)
  const pinned = pinnedRequestId === request.id
  const translatedParagraphs = result?.text.split(/\n{2,}/).filter(Boolean) || []

  const card = (
    <View
      className="absolute w-80 rounded-2xl border border-zinc-300 bg-zinc-50 p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ top, left, maxHeight: maxCardHeight, zIndex: 1000, elevation: 12 }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <NouText className="text-sm font-semibold">
          {result?.sourceLanguage
            ? `${result.sourceLanguage} → ${request.targetLanguage}`
            : t('settings.translation.loading')}
        </NouText>
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(pinned ? 'settings.translation.unpin' : 'settings.translation.pin')}
            accessibilityState={{ selected: pinned }}
            hitSlop={8}
            onPress={() => setPinnedRequestId(pinned ? null : request.id)}
          >
            <MaterialIcons name="push-pin" size={20} color={pinned ? '#2563eb' : '#71717a'} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('buttons.cancel')} hitSlop={8} onPress={close}>
            <MaterialIcons name="close" size={20} color="#71717a" />
          </Pressable>
        </View>
      </View>
      {nIf(
        Boolean(result),
        <ScrollView
          className="mt-3"
          style={{ maxHeight: maxCardHeight - 116, marginRight: -16 }}
          contentContainerStyle={{ paddingRight: 16 }}
          nestedScrollEnabled
          persistentScrollbar
          showsVerticalScrollIndicator
        >
          {translatedParagraphs.map((paragraph, index) => (
            <NouText
              key={`${index}-${paragraph.slice(0, 24)}`}
              className={index < translatedParagraphs.length - 1 ? 'mb-3 text-base leading-6' : 'text-base leading-6'}
            >
              {paragraph}
            </NouText>
          ))}
        </ScrollView>,
      )}
      {nIf(!result && Boolean(error), <NouText className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</NouText>)}
      {nIf(!result && !error, <ActivityIndicator className="mt-5 mb-2" />)}
      {nIf(
        Boolean(result),
        <View className="mt-4 flex-row items-center justify-between gap-2">
          <Pressable
            className="rounded-full border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            onPress={() => void Clipboard.setStringAsync(request.text)}
          >
            <NouText className="text-xs font-semibold">{t('settings.translation.copySource')}</NouText>
          </Pressable>
          <Pressable
            className="rounded-full border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            onPress={() => void Clipboard.setStringAsync(result?.text || '')}
          >
            <NouText className="text-xs font-semibold">{t('settings.translation.copy')}</NouText>
          </Pressable>
        </View>,
      )}
    </View>
  )

  return (
    <View pointerEvents="box-none" className="absolute inset-0" style={{ zIndex: 1000 }}>
      {nIf(!pinned, <Pressable className="absolute inset-0" onPress={close} />)}
      {card}
    </View>
  )
}
