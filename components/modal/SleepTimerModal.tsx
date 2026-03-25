import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, View } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { NouButton } from '../button/NouButton'
import { t } from 'i18next'
import { showToast } from '@/lib/toast'
import {
  formatSleepTimerRemaining,
  parseSleepTimerMinutes,
  SLEEP_TIMER_MINUTES_PRESETS,
  useSleepTimerStatus,
} from '@/lib/sleep-timer'
import {
  clearNativeSleepTimer,
  getNativeSleepTimerRemainingMs,
  hasSleepTimerNativeSupport,
  setNativeSleepTimer,
} from '@/lib/sleep-timer-native'
import { sleepTimer$ } from '@/states/sleep-timer'

export const SleepTimerModal = () => {
  const sleepTimerModalOpen = useValue(ui$.sleepTimerModalOpen)
  const supported = hasSleepTimerNativeSupport()
  const { active, remainingMs } = useSleepTimerStatus(sleepTimerModalOpen)
  const [text, setText] = useState('')
  const [replaceMode, setReplaceMode] = useState(false)
  const onClose = () => ui$.sleepTimerModalOpen.set(false)

  useEffect(() => {
    if (!sleepTimerModalOpen || !supported) {
      return
    }

    setText('')
    setReplaceMode(false)
    void getNativeSleepTimerRemainingMs()
      .then((nextRemainingMs) => sleepTimer$.setRemainingMs(nextRemainingMs))
      .catch((error) => {
        console.error('getSleepTimerRemainingMs failed', error)
      })
  }, [sleepTimerModalOpen, supported])

  useEffect(() => {
    if (!active) {
      setReplaceMode(false)
    }
  }, [active])

  if (!sleepTimerModalOpen || !supported) {
    return null
  }

  const setTimer = async (minutes: number) => {
    await setNativeSleepTimer(minutes * 60 * 1000)
    showToast(t('sleepTimer.setToast', { value: minutes }))
    onClose()
  }

  const onSubmit = async () => {
    const parsed = parseSleepTimerMinutes(text)
    if (!parsed.ok) {
      showToast(t('sleepTimer.validation.minutes'))
      return
    }

    await setTimer(parsed.minutes)
  }

  const onCancelTimer = async () => {
    await clearNativeSleepTimer()
    showToast(t('sleepTimer.cancelToast'))
  }

  const showingActiveState = active && !replaceMode

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="mb-2 text-lg font-semibold">{t('sleepTimer.label')}</NouText>
        {showingActiveState ? (
          <>
            <NouText className="mb-3 text-sm leading-5 text-gray-400">{t('sleepTimer.activeHint')}</NouText>
            <NouText className="mb-6 text-4xl font-semibold tracking-tight">
              {formatSleepTimerRemaining(remainingMs)}
            </NouText>
            <View className="flex-row items-center justify-end gap-2">
              <NouButton variant="soft" size="1" onPress={() => void onCancelTimer()}>
                {t('sleepTimer.cancel')}
              </NouButton>
              <NouButton size="1" onPress={() => setReplaceMode(true)}>
                {t('sleepTimer.replace')}
              </NouButton>
            </View>
          </>
        ) : (
          <>
            <NouText className="mb-5 text-sm leading-5 text-gray-400">{t('sleepTimer.hint')}</NouText>

            <View className="mb-5 flex-row flex-wrap gap-2">
              {SLEEP_TIMER_MINUTES_PRESETS.map((minutes) => (
                <NouButton key={minutes} variant="soft" size="1" onPress={() => void setTimer(minutes)}>
                  {t('sleepTimer.preset', { value: minutes })}
                </NouButton>
              ))}
            </View>

            <TextInput
              className="mb-6 rounded border border-gray-600 p-3 text-white text-sm"
              value={text}
              onChangeText={setText}
              placeholder={t('sleepTimer.customPlaceholder')}
              placeholderTextColor={gray.gray11}
              keyboardType="number-pad"
            />

            <View className="flex-row items-center justify-between">
              <NouButton
                variant="outline"
                size="1"
                onPress={() => {
                  if (active) {
                    setReplaceMode(false)
                    return
                  }
                  onClose()
                }}
              >
                {t('buttons.cancel')}
              </NouButton>
              <NouButton size="1" onPress={() => void onSubmit()}>
                {t('sleepTimer.set')}
              </NouButton>
            </View>
          </>
        )}
      </View>
    </BaseCenterModal>
  )
}
