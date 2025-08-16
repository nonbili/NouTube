import { TouchableOpacity, View } from 'react-native'
import { NouText } from '../NouText'
import { Image } from 'expo-image'
import { use$ } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { isWeb } from '@/lib/utils'
import { signInWithGoogle, signOut } from '@/lib/supabase/auth'
import { NouLink } from '../link/NouLink'
import { NouMenu } from '../menu/NouMenu'
import { capitalize } from 'es-toolkit'

export const SettingsModalTabSync = () => {
  const { user, plan } = use$(auth$)

  return (
    <>
      <View className="pt-10">
        <NouText className="font-medium text-base mb-8">
          Sync bookmarks across your phones and computers as a premium user.
        </NouText>
        {!user &&
          (isWeb ? (
            <a
              className="text-sm py-2 px-6 text-center bg-[#6366f1] rounded-full flex-row justify-center"
              href="https://noutube.inks.page/auth/app"
              target="_blank"
            >
              Sign in
            </a>
          ) : (
            <TouchableOpacity
              className="text-sm py-2 px-6 text-center bg-[#6366f1] rounded-full flex-row justify-center"
              onPress={signInWithGoogle}
            >
              <NouText>Sign in with Google</NouText>
            </TouchableOpacity>
          ))}
        {user && plan && (
          <>
            <View className="flex-row items-center gap-4 mt-2">
              <NouText>Current plan: {capitalize(plan)}</NouText>
              <NouLink
                className="text-sm py-2 px-6 text-center bg-[#6366f1] rounded-full flex-row justify-center text-white"
                href="https://noutube.inks.page/app"
              >
                Manage plan
              </NouLink>
            </View>
          </>
        )}
      </View>
      {user ? (
        <View className="mt-6">
          <NouMenu
            trigger={
              <View className="flex-row items-center gap-2 py-2">
                <View className="">
                  <Image
                    style={{ width: 32, height: 32, borderRadius: '100%', backgroundColor: 'lightblue' }}
                    source={user.picture}
                    contentFit="cover"
                  />
                </View>
                <NouText>{user.email}</NouText>
              </View>
            }
            items={[{ label: 'Sign out', handler: signOut }]}
          />
        </View>
      ) : null}
    </>
  )
}
