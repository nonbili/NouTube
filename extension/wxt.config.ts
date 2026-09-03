import { defineConfig } from 'wxt'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import reactNativeWeb from 'vite-plugin-react-native-web'
import type { Plugin } from 'vite'

const extensionDir = process.cwd()
const rootDir = resolve(extensionDir, '..')

/*
 * WXT owns the `@` alias and points it at this directory, but the content
 * bundle and the shared lib/ it pulls in are written against the app's `@`,
 * which is the repo root. Rewriting the specifier before resolution leaves
 * both meanings intact instead of fighting over one alias.
 */
const rewriteRootAliases = {
  name: 'noutube-rewrite-root-aliases',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.startsWith(rootDir) || id.includes('node_modules')) {
      return
    }
    return code.replaceAll("'@/", "'noutube-root/").replaceAll('"@/', '"noutube-root/')
  },
}

/*
 * The app's data layer assumes a phone or an Electron renderer. These are the
 * seams where the extension takes over: persistence, the Supabase client, the
 * main-process bridge, the react-native helpers and the toaster.
 *
 * Matched on the resolved file rather than the specifier, because the app
 * reaches these modules through both `@/lib/...` and relative paths, and an
 * alias only ever sees the specifier.
 */
const persistMemory = resolve(extensionDir, 'lib/app/persist-memory.ts')
const appReplacements = new Map([
  [resolve(rootDir, 'states/indexeddb.ts'), persistMemory],
  [resolve(rootDir, 'lib/supabase/client.ts'), resolve(extensionDir, 'lib/app/supabase-client.ts')],
  [resolve(rootDir, 'lib/main-client.ts'), resolve(extensionDir, 'lib/app/main-client.ts')],
  [resolve(rootDir, 'lib/utils.ts'), resolve(extensionDir, 'lib/app/utils.ts')],
  [resolve(rootDir, 'lib/toast.ts'), resolve(extensionDir, 'lib/app/toast.ts')],
])

/*
 * Copied from the desktop renderer: react-native-css-interop declares
 * `"sideEffects": false`, so Rollup drops the require() that registers
 * View/Text/etc. into the interop registry and every className is silently lost.
 */
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

const replaceAppModules = {
  name: 'noutube-app-replacements',
  enforce: 'pre' as const,
  async resolveId(this: any, source: string, importer: string | undefined, options: any) {
    if (source === '@legendapp/state/persist-plugins/mmkv') {
      return persistMemory
    }
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
    const replacement = resolved && appReplacements.get(resolved.id)
    return replacement ? { ...resolved, id: replacement } : resolved
  },
}

export default defineConfig({
  // The react module pulls @vitejs/plugin-react 6, which wants Vite 8; the repo
  // is on Vite 7, so the plugin is wired up directly instead.
  vite: () => ({
    define: {
      // The app's components branch on it through expo's platform helpers.
      'process.env.EXPO_OS': JSON.stringify('web'),
    },
    plugins: [
      rewriteRootAliases,
      replaceAppModules,
      keepCssInteropSideEffects(),
      react({
        babel: {
          // NativeWind resolves `className` on react-native components through
          // its own JSX runtime.
          plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic', importSource: 'nativewind' }]],
        },
      }),
      reactNativeWeb(),
    ],
    resolve: {
      alias: {
        'noutube-root': rootDir,
        'expo-modules-core-polyfill': resolve(rootDir, 'node_modules/expo-modules-core/src/polyfill/index.web.ts'),
      },
    },
  }),
  zip: {
    sourcesRoot: rootDir,
    includeSources: ['package.json', 'bun.lock', 'bunfig.toml', 'tsconfig.json', 'assets/images/**', 'content/**', 'lib/**', 'locales/**', 'extension/**'],
  },
  manifest: ({ browser }) => ({
    name: 'NouTube',
    description: 'YouTube tweaks: hide shorts, blocklist, SponsorBlock, dislikes, user styles and scripts.',
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    permissions: ['storage', 'userScripts', 'alarms', 'identity'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://m.youtube.com/*',
      'https://music.youtube.com/*',
      'https://pgukcvgypvjwtibzlvhr.supabase.co/*',
      'https://a.inks.page/*',
      'https://noutube.inks.page/*',
    ],
    browser_specific_settings:
      browser === 'firefox'
        ? ({
            gecko: {
              id: 'browser-extension@noutube.nonbili.jp',
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
          } as any)
        : undefined,
  }),
})
