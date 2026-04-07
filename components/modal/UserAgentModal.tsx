import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, TouchableOpacity, View } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { NouButton } from '../button/NouButton'
import { t } from 'i18next'
import { settings$ } from '@/states/settings'
import { showToast } from '@/lib/toast'
import { getUserAgent } from '@/lib/useragent'
import { isWeb } from '@/lib/utils'

export const UserAgentModal = () => {
  const userAgentModalOpen = useValue(ui$.userAgentModalOpen)
  const userAgent = useValue(settings$.userAgent)
  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [text, setText] = useState('')
  const defaultUserAgent = getUserAgent(isWeb ? window.electron.process.platform : 'android')
  const onClose = () => ui$.userAgentModalOpen.set(false)

  useEffect(() => {
    if (!userAgentModalOpen) {
      return
    }
    const value = userAgent || ''
    setText(value)
    setMode(value.trim() ? 'custom' : 'default')
  }, [userAgentModalOpen, userAgent])

  const onSubmit = () => {
    if (mode === 'default') {
      settings$.userAgent.set('')
      onClose()
      return
    }

    if (!text.trim()) {
      showToast('Please enter a custom user agent')
      return
    }
    settings$.userAgent.set(text)
    onClose()
  }

  if (!userAgentModalOpen) {
    return null
  }

  const checkedCls = 'w-5 h-5 rounded-full border border-zinc-400 dark:border-white items-center justify-center'

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="text-lg font-semibold mb-5">{t('settings.userAgent.title')}</NouText>

        <TouchableOpacity className="mb-4" onPress={() => setMode('default')}>
          <View className="flex-row items-center">
            <View className={checkedCls}>
              {mode === 'default' && <View className="w-2.5 h-2.5 rounded-full bg-zinc-700 dark:bg-white" />}
            </View>
            <NouText className="ml-3 font-medium">{t('settings.userAgent.default')}</NouText>
          </View>
          <NouText className="ml-8 mt-2 text-zinc-600 dark:text-gray-400 text-sm">{defaultUserAgent}</NouText>
        </TouchableOpacity>

        <TouchableOpacity className="mb-3" onPress={() => setMode('custom')}>
          <View className="flex-row items-center">
            <View className={checkedCls}>
              {mode === 'custom' && <View className="w-2.5 h-2.5 rounded-full bg-zinc-700 dark:bg-white" />}
            </View>
            <NouText className="ml-3 font-medium">{t('settings.userAgent.title')}</NouText>
          </View>
          <TextInput
            className="ml-8 mt-2 border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 rounded text-zinc-900 dark:text-white text-sm min-h-24 p-2"
            value={text}
            onChangeText={(value) => {
              setText(value)
              setMode('custom')
            }}
            placeholder="Mozilla/5.0 ..."
            placeholderTextColor={gray.gray11}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
          />
        </TouchableOpacity>

        <View className="mt-4 flex-row items-center justify-between">
          <NouButton variant="outline" size="1" onPress={onClose}>
            {t('buttons.cancel')}
          </NouButton>
          <NouButton onPress={onSubmit}>{t('buttons.save')}</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
