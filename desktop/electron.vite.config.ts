import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import reactNativeWeb from 'vite-plugin-react-native-web'
import type { Plugin } from 'vite'

// react-native-css-interop declares `"sideEffects": false`, so Rollup drops the
// `require("./components")` inside wrapJSX that registers View/Text/etc. into
// interopComponents. Without it, production builds silently discard className.
const keepCssInteropSideEffects = (): Plugin => ({
  name: 'keep-css-interop-side-effects',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (importer?.includes('react-native-css-interop') || source.includes('react-native-css-interop')) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved?.id.includes('react-native-css-interop')) {
        return { ...resolved, moduleSideEffects: true }
      }
      return resolved
    }
    return null
  },
})

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@': 'noutube',
        main: resolve('src/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['noutube'] })],
  },
  renderer: {
    define: {
      'process.env.EXPO_OS': JSON.stringify('web'),
    },
    resolve: {
      alias: {
        '@': 'noutube',
        '@renderer': resolve('src/renderer'),
        main: resolve('src/main'),
        'expo-modules-core-polyfill': resolve('../node_modules/expo-modules-core/src/polyfill/index.web.ts'),
      },
    },
    plugins: [
      keepCssInteropSideEffects(),
      react({
        // https://stackoverflow.com/a/79079523
        babel: {
          plugins: [
            [
              '@babel/plugin-transform-react-jsx',
              {
                runtime: 'automatic',
                importSource: 'nativewind',
              },
            ],
          ],
        },
      }),
      reactNativeWeb(),
    ],
  },
})
