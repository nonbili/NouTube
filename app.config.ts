import 'ts-node/register'

import { ExpoConfig } from 'expo/config'
import { version, versionCode } from './package.json'

const intentFilters = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube.com', 'youtu.be'].map(
  (host) => ({
    autoVerify: false,
    action: 'VIEW',
    data: {
      scheme: 'https',
      host,
    },
    category: ['BROWSABLE', 'DEFAULT'],
  }),
)

module.exports = ({ config }: { config: ExpoConfig }) => {
  return {
    name: 'NouTube',
    slug: 'noutube',
    version,
    icon: './assets/images/icon.png',
    scheme: 'noutube',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'jp.nonbili.noutube',
    },
    android: {
      versionCode,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        monochromeImage: './assets/images/monochrome-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'jp.nonbili.noutube',
      intentFilters,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      './plugins/withAndroidPlugin.ts',
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#f9fafb',
          dark: {
            image: './assets/images/splash-icon.png',
            backgroundColor: '#27272a',
          },
        },
      ],
      'expo-asset',
      'expo-font',
      [
        'expo-localization',
        {
          supportedLocales: ['en', 'fr', 'id', 'ru', 'zh-Hans'],
        },
      ],
      'expo-share-intent',
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
    },
  }
}
