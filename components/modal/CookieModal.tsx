import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, View, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { NouButton } from '../button/NouButton'
import { t } from 'i18next'
import { showToast } from '@/lib/toast'
import { isWeb } from '@/lib/utils'

export const CookieModal = () => {
  const cookieModalOpen = useValue(ui$.cookieModalOpen)
  const [text, setText] = useState('')
  const onClose = () => ui$.cookieModalOpen.set(false)

  useEffect(() => {
    setText('')
  }, [cookieModalOpen])

  const onSubmit = async () => {
    const cookie = text.trim()
    if (!cookie) {
      showToast('Invalid cookie')
      return
    }

    const webview = ui$.webview.get()
    if (!webview) {
      showToast('WebView not ready')
      return
    }

    if (isWeb) {
      const { mainClient } = await import('@/desktop/src/renderer/ipc/main')
      await mainClient.setCookie(cookie)
      webview.executeJavaScript('location.reload()')
    } else {
      const script =
        cookie
          .split(';')
          .map((x) => `document.cookie="${x.trim()};max-age=31536000;path=/;domain=.youtube.com";`)
          .join('') + 'location.reload();'

      webview.executeJavaScript(script)
    }
    onClose()
    showToast('Cookie injected')
  }
  if (!cookieModalOpen) {
    return null
  }

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="text-lg font-semibold mb-4">{t('settings.injectCookieTitle')}</NouText>
        <NouText className="mb-4 text-gray-400 text-sm leading-5">{t('settings.injectCookieHint')}</NouText>
        <TextInput
          className="border border-gray-600 rounded mb-6 text-white p-2 text-sm"
          value={text}
          onChangeText={setText}
          placeholder="key1=val1; key2=val2"
          placeholderTextColor={gray.gray11}
          multiline
          numberOfLines={3}
          autoFocus
        />
        <View className="flex-row items-center justify-between">
          <NouButton variant="outline" size="1" onPress={onClose}>
            {t('buttons.cancel')}
          </NouButton>
          <NouButton onPress={onSubmit}>{t('buttons.save')}</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
