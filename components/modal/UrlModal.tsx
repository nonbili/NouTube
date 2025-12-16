import { use$ } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, View } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { NouButton } from '../button/NouButton'
import { openSharedUrl } from '@/lib/page'

export const UrlModal = () => {
  const urlModalOpen = use$(ui$.urlModalOpen)
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
        <NouText className="text-lg font-semibold mb-4">Open URL</NouText>
        <NouText className="mb-1 font-semibold text-gray-300">URL</NouText>
        <TextInput
          className="border border-gray-600 rounded mb-3 text-white p-2 text-sm"
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.youtube.com/watch?v=xxx"
          placeholderTextColor={gray.gray11}
          autoFocus
        />
        <View className="">
          <NouText className="text-gray-400 text-sm">Supported URLs</NouText>
          <NouText className="text-gray-500 text-sm">https://*.youtube.com/*</NouText>
          <NouText className="text-gray-500 text-sm">https://youtu.be/*</NouText>
          <NouText className="text-gray-500 text-sm">noutube:*</NouText>
        </View>
        <View className="flex-row items-center justify-between mt-6">
          <NouButton variant="outline" size="1" onPress={onClose}>
            Cancel
          </NouButton>
          <NouButton onPress={onSubmit}>Open</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
