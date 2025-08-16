import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import reactNativeWeb from 'vite-plugin-react-native-web'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        main: resolve('src/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['noutube'] })],
  },
  renderer: {
    resolve: {
      alias: {
        '@': 'noutube',
        '@renderer': resolve('src/renderer'),
        main: resolve('src/main'),
      },
    },
    plugins: [
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
