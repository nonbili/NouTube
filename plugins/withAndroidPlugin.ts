import { ConfigPlugin, withGradleProperties, withMainActivity } from '@expo/config-plugins'
import { withAndroidManifest, withAppBuildGradle } from '@expo/config-plugins/build/plugins/android-plugins.js'

// React Native seeds DisplayMetricsHolder from the *application* context
// (ReactRootView.init, ReactHostImpl.onConfigurationChanged), which always
// reports the default display. When the activity runs on a secondary display --
// an external monitor in desktop mode -- the density it records is the phone's,
// not the monitor's. PixelUtil derives every dp/sp -> px conversion from those
// metrics, so all text (icon fonts included) rasterises at the wrong scale while
// Fabric lays out at the correct one. Re-point the holder at this activity's
// display once React Native has initialised it.
const DISPLAY_METRICS_FIX = `
  private fun syncDisplayMetricsToCurrentDisplay() {
    val activityMetrics = resources.displayMetrics
    val screenMetrics = android.util.DisplayMetrics()
    screenMetrics.setTo(activityMetrics)
    try {
      @Suppress("DEPRECATION")
      (getSystemService(android.content.Context.WINDOW_SERVICE) as android.view.WindowManager)
        .defaultDisplay
        .getRealMetrics(screenMetrics)
    } catch (e: Exception) {
      // Non-visual context; the copy made above is a good enough fallback.
    }
    // getRealMetrics() reports real pixel bounds but the *default* display's
    // density, so keep its bounds and take the density from this activity.
    screenMetrics.density = activityMetrics.density
    screenMetrics.densityDpi = activityMetrics.densityDpi
    @Suppress("DEPRECATION")
    screenMetrics.scaledDensity = activityMetrics.scaledDensity
    screenMetrics.xdpi = activityMetrics.xdpi
    screenMetrics.ydpi = activityMetrics.ydpi
    com.facebook.react.uimanager.DisplayMetricsHolder.setScreenDisplayMetrics(screenMetrics)
    com.facebook.react.uimanager.DisplayMetricsHolder.setWindowDisplayMetrics(activityMetrics)
  }

  override fun onResume() {
    super.onResume()
    syncDisplayMetricsToCurrentDisplay()
  }

  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    syncDisplayMetricsToCurrentDisplay()
    window?.decorView?.requestLayout()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      syncDisplayMetricsToCurrentDisplay()
    }
  }
`

const withSecondaryDisplayMetricsFix: ConfigPlugin = (config) =>
  withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withSecondaryDisplayMetricsFix expects a Kotlin MainActivity')
    }
    if (config.modResults.contents.includes('syncDisplayMetricsToCurrentDisplay')) {
      return config
    }
    const anchor = 'class MainActivity : ReactActivity() {'
    if (!config.modResults.contents.includes(anchor)) {
      throw new Error('withSecondaryDisplayMetricsFix could not find the MainActivity class declaration')
    }
    config.modResults.contents = config.modResults.contents.replace(anchor, `${anchor}\n${DISPLAY_METRICS_FIX}`)
    return config
  })

const withAndroidSigningConfig: ConfigPlugin = (config) => {
  config = withSecondaryDisplayMetricsFix(config)

  config = withAndroidManifest(config, (config: any) => {
    const app = config.modResults.manifest.application?.[0]
    if (app) {
      app.$['android:extractNativeLibs'] = 'true'
    }
    return config
  })

  // Bump JVM memory: release builds run out of the default 512m Metaspace on
  // CI, failing :app:packageRelease. See workflow run 27182763983.
  config = withGradleProperties(config, (config) => {
    const value = '-Xmx4g -XX:MaxMetaspaceSize=2g'
    const existing = config.modResults.find(
      (item): item is { type: 'property'; key: string; value: string } =>
        item.type === 'property' && item.key === 'org.gradle.jvmargs',
    )
    if (existing) {
      existing.value = value
    } else {
      config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value })
    }
    return config
  })

  return withAppBuildGradle(config, (config) => {
    // https://www.reddit.com/r/expo/comments/1j4v323/comment/mit9b2a/
    config.modResults.contents = config.modResults.contents
      .replace(
        'android {',
        `ext.abiCodes = [x86:1, x86_64:2, 'armeabi-v7a':3, 'arm64-v8a': 4]

android {
    flavorDimensions "distribution"
    productFlavors {
        full {
            dimension "distribution"
        }
        foss {
            dimension "distribution"
        }
    }`,
      )
      .replace('zh-Hans', 'b+zh+Hans')
      .replace('zh-Hant', 'b+zh+Hant')
      .replace('pt-BR', 'b+pt+BR')
      .replace(
        /buildTypes \{([\s\S]*?)release \{([\s\S]*?)signingConfig signingConfigs\.debug/,
        `buildTypes {$1release { `,
      )
      .replace(
        /androidResources \{([\s\S]*?)}/,
        `androidResources {$1}
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include project.ext.abiCodes.keySet() as String[]
        }
    }
    android.applicationVariants.configureEach { variant ->
        variant.outputs.each { output ->
            def baseAbiVersionCode = project.ext.abiCodes.get(output.getFilter(com.android.build.OutputFile.ABI))
            if (baseAbiVersionCode != null) {
                output.versionCodeOverride = (100 * project.android.defaultConfig.versionCode) + baseAbiVersionCode
            }
        }
    }`,
      )

    return config
  })
}

export default withAndroidSigningConfig
