import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, View } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { NouButton } from '../button/NouButton'
import { openSharedUrl } from '@/lib/page'
import { t } from 'i18next'

export const UrlModal = () => {
  const urlModalOpen = useValue(ui$.urlModalOpen)
  const [url, setUrl] = useState('')
  const onClose = () => ui$.urlModalOpen.set(false)

  useEffect(() => {
    setUrl('')
  }, [urlModalOpen])

  const onSubmit = () => {
    if (!url.trim()) {
      return
    }
    openSharedUrl(url)
    onClose()
    ui$.settingsModalOpen.set(false)
  }

  if (!urlModalOpen) {
    return null
  }

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="text-lg font-semibold mb-4">{t('buttons.openUrl')}</NouText>
        <NouText className="mb-1 font-semibold text-zinc-700 dark:text-zinc-300">URL</NouText>
        <TextInput
          className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded mb-3 text-zinc-900 dark:text-zinc-100 p-2 text-sm"
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.youtube.com/watch?v=xxx"
          placeholderTextColor={gray.gray11}
          autoFocus
        />
        <View className="">
          <NouText className="text-zinc-600 dark:text-gray-400 text-sm">Supported URLs</NouText>
          <NouText className="text-zinc-500 dark:text-gray-500 text-sm">https://*.youtube.com/*</NouText>
          <NouText className="text-zinc-500 dark:text-gray-500 text-sm">https://youtu.be/*</NouText>
          <NouText className="text-zinc-500 dark:text-gray-500 text-sm">noutube:*</NouText>
        </View>
        <View className="flex-row items-center justify-between mt-6">
          <NouButton variant="outline" size="1" onPress={onClose}>
            {t('buttons.cancel')}
          </NouButton>
          <NouButton onPress={onSubmit}>{t('buttons.open')}</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
