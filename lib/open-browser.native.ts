import { openBrowserAsync } from 'expo-web-browser'

export const openBrowser = async (url: string) => {
  await openBrowserAsync(url)
}
