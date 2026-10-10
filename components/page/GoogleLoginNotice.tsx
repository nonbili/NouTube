import { Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useValue } from '@legendapp/state/react'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { SIGN_IN_FAQ_URL } from '@/lib/help'
import { useTwColor } from '@/lib/theme'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { NouLink } from '../link/NouLink'

export function GoogleLoginNotice({ url }: { url: string }) {
  try {
    const { hostname } = new URL(url)
    if (
      hostname !== 'accounts.youtube.com' &&
      !/^(accounts|gds)\.google\.(com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/.test(hostname)
    ) {
      return null
    }
  } catch {
    return null
  }

  return <GoogleLoginBanner />
}

function GoogleLoginBanner() {
  const { t } = useTranslation()
  const tw = useTwColor()
  const dismissed = useValue(ui$.googleLoginNoticeDismissed)

  if (dismissed) {
    return null
  }

  return (
    <View className="bg-amber-100 dark:bg-amber-950 px-4 py-3 gap-2">
      <View className="flex-row items-start gap-3">
        <NouText className="flex-1 text-sm text-amber-950 dark:text-amber-100">
          {t('settings.googleLoginCookieHint')}
        </NouText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('menus.close')}
          hitSlop={8}
          onPress={() => ui$.googleLoginNoticeDismissed.set(true)}
        >
          <MaterialIcons name="close" size={18} color={tw('zinc-500')} />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-4">
        <NouButton size="1" onPress={() => ui$.cookieModalOpen.set(true)}>
          {t('settings.injectCookieAction')}
        </NouButton>
        <NouLink href={SIGN_IN_FAQ_URL} className="text-sm text-blue-600 dark:text-blue-400 underline">
          {t('settings.cookieFaq')}
        </NouLink>
      </View>
    </View>
  )
}
