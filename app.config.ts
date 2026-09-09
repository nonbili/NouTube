import 'ts-node/register'

import { ExpoConfig } from 'expo/config'
import { version, versionCode } from './package.json'

const intentFilters = [
  {
    autoVerify: false,
    action: 'VIEW',
    data: ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube.com', 'youtu.be'].map((host) => ({
      scheme: 'https',
      host,
    })),
    category: ['BROWSABLE', 'DEFAULT'],
  },
]

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
      appleTeamId: 'NXW8RMPV8L',
      infoPlist: {
        // The player keeps going with the screen off and on the lock screen.
        UIBackgroundModes: ['audio'],
        NSMicrophoneUsageDescription: 'Voice search on YouTube uses the microphone.',
      },
    },
    android: {
      versionCode,
      permissions: ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'POST_NOTIFICATIONS', 'WAKE_LOCK'],
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        monochromeImage: './assets/images/monochrome-icon.png',
        backgroundColor: '#ffffff',
      },
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
      'expo-status-bar',
      'expo-image',
      [
        'expo-localization',
        {
          supportedLocales: ['en', 'de', 'es', 'fr', 'id', 'ja', 'pl', 'pt', 'pt-BR', 'ru', 'tr', 'uk', 'vi', 'zh-Hans', 'zh-Hant'],
        },
      ],
      [
        'expo-sharing',
        {
          // No ios entry: the share extension needs the app group
          // group.jp.nonbili.noutube registered with the Apple team before it
          // can be signed. Until then lib/incoming-share.ios.ts stands in.
          android: {
            enabled: true,
            singleShareMimeTypes: ['text/*'],
          },
        },
      ],
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
    },
  }
}
