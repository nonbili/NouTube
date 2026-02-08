import { TouchableOpacity, View } from 'react-native'
import { NouText } from '../NouText'
import { Image } from 'expo-image'
import { useValue } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { isWeb, isIos, nIf } from '@/lib/utils'
import { signOut } from '@/lib/supabase/auth'
import { NouLink } from '../link/NouLink'
import { NouMenu } from '../menu/NouMenu'
import { capitalize } from 'es-toolkit'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'

export const SettingsModalTabSync = () => {
  const { user, plan } = useValue(auth$)

  return (
    <>
      <View className="pt-10">
        <NouText className="font-medium text-base mb-8">{t('sync.hint')}</NouText>
        {nIf(
          !user,
          <View className="flex-row justify-center">
            <NouLink
              className="text-sm py-2 px-6 text-center bg-[#6366f1] rounded-full flex-row justify-center text-white"
              href="https://noutube.inks.page/auth/app"
              target="_blank"
            >
              Login NouTube
            </NouLink>
          </View>,
        )}
        {user && plan ? (
          <>
            <View className="flex-row items-center gap-4 mt-2">
              <NouText className="flex-1">
                {t('sync.currentPlan')}: {capitalize(plan)}
              </NouText>
              <NouLink
                className="text-sm py-2 px-6 text-center bg-[#6366f1] rounded-full flex-row justify-center text-white"
                href="https://noutube.inks.page/app"
              >
                {t('sync.managePlan')}
              </NouLink>
            </View>
          </>
        ) : null}
      </View>
      {nIf(
        user,
        <View className="mt-6 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2 py-2 flex-1 mr-4">
            <View className="">
              <Image
                style={{ width: 32, height: 32, borderRadius: '100%', backgroundColor: 'lightblue' }}
                source={user?.picture}
                contentFit="cover"
              />
            </View>
            <NouText className="flex-1">{user?.email}</NouText>
          </View>
          <NouMenu
            trigger={isWeb ? <MaterialButton name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
            items={[{ label: t('buttons.signOut'), handler: signOut }]}
          />
        </View>,
      )}
    </>
  )
}
