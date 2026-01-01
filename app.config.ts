import 'ts-node/register'

import { ExpoConfig } from 'expo/config'
import { version, versionCode } from './package.json'

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
      intentFilters: [
        {
          autoVerify: false,
          action: 'VIEW',
          data: {
            scheme: 'https',
            host: '*youtube.com',
          },
          category: ['BROWSABLE', 'DEFAULT'],
        },
        {
          autoVerify: false,
          action: 'VIEW',
          data: {
            scheme: 'https',
            host: 'youtu.be',
          },
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      'expo-asset',
      'expo-font',
      [
        'expo-localization',
        {
          supportedLocales: ['en'],
        },
      ],
      'expo-share-intent',
      'expo-web-browser',
      './plugins/withAndroidPlugin.ts',
    ],
    experiments: {
      typedRoutes: true,
    },
  }
}
