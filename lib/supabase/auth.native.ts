import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin'
import { supabase } from './client'

export const signOut = () => supabase.auth.signOut({ scope: 'local' })

GoogleSignin.configure({
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ||
    '696868359033-gi0alu5ohkodr511d7md3kc1u60v5u8r.apps.googleusercontent.com',
})

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices()
    const userInfo = await GoogleSignin.signIn()
    if (userInfo.data?.idToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      })
      if (error) {
        throw error
      }
    } else {
      throw new Error('no ID token present!')
    }
  } catch (error: any) {
    console.error('signInWithGoogle error', error)
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
    } else if (error.code === statusCodes.IN_PROGRESS) {
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    } else {
    }
  }
}
