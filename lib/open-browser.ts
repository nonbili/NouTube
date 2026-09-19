import { Linking } from 'react-native'

export const openBrowser = async (url: string) => {
  await Linking.openURL(url)
}
