import { describe, expect, it } from 'bun:test'
import type { ExportedConfig } from '@expo/config-plugins'
import withAndroidPlugin from './withAndroidPlugin'

const screenMetrics = 'com.facebook.react.uimanager.DisplayMetricsHolder.setScreenDisplayMetrics(screenMetrics)'
const windowMetrics = 'com.facebook.react.uimanager.DisplayMetricsHolder.setWindowDisplayMetrics(activityMetrics)'
const desktopMode = 'expo.modules.noutubeview.nouController.updateDesktopMode(this)'
const activity = (body = '') => `class MainActivity : ReactActivity() {\n${body}\n}`

async function applyMainActivity(contents: string) {
  const config: ExportedConfig = withAndroidPlugin({ name: 'NouTube', slug: 'noutube' })
  const result = await config.mods!.android!.mainActivity!({
    ...config,
    modRawConfig: config,
    modResults: { path: 'MainActivity.kt', language: 'kt', contents },
    modRequest: {
      projectRoot: process.cwd(),
      platformProjectRoot: `${process.cwd()}/android`,
      platform: 'android',
      modName: 'mainActivity',
      introspect: true,
    },
  })
  return result.modResults.contents
}

describe('Android display metrics compatibility', () => {
  it('generates the screen-metrics setter supported by React Native 0.88', async () => {
    const result = await applyMainActivity(activity())
    expect(result).toContain(screenMetrics)
    expect(result).toContain(desktopMode)
    expect(result).not.toContain(windowMetrics)
    expect(await applyMainActivity(result)).toBe(result)
  })

  for (const hasDesktopMode of [false, true]) {
    it(`migrates an older activity ${hasDesktopMode ? 'with' : 'without'} desktop-mode notifications`, async () => {
      const result = await applyMainActivity(activity(`
  private fun syncDisplayMetricsToCurrentDisplay() {
    ${screenMetrics}
    ${windowMetrics}
    ${hasDesktopMode ? desktopMode : ''}
  }`))
      expect(result).not.toContain(windowMetrics)
      expect(result.split(screenMetrics)).toHaveLength(2)
      expect(result.split(desktopMode)).toHaveLength(2)
      expect(await applyMainActivity(result)).toBe(result)
    })
  }
})

it('enables extraction through Gradle packaging and replaces an existing false value', async () => {
  const config: ExportedConfig = withAndroidPlugin({ name: 'NouTube', slug: 'noutube' })
  const input = {
    ...config,
    modRawConfig: config,
    modResults: [{ type: 'property' as const, key: 'expo.useLegacyPackaging', value: 'false' }],
    modRequest: {
      projectRoot: process.cwd(),
      platformProjectRoot: `${process.cwd()}/android`,
      platform: 'android' as const,
      modName: 'gradleProperties',
      introspect: true,
    },
  }
  const mod = config.mods!.android!.gradleProperties!
  const result = await mod(input)
  expect(result.modResults.filter((item) => item.type === 'property' && item.key === 'expo.useLegacyPackaging'))
    .toEqual([{ type: 'property', key: 'expo.useLegacyPackaging', value: 'true' }])
  const firstRun = structuredClone(result.modResults)
  expect((await mod(result)).modResults).toEqual(firstRun)
})
