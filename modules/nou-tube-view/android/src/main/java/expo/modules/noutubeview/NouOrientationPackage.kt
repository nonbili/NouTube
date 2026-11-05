package expo.modules.noutubeview

import android.app.Activity
import android.content.Context
import android.os.Bundle
import expo.modules.core.BasePackage
import expo.modules.core.interfaces.ReactActivityLifecycleListener

internal object NouOrientationPreferences {
  private const val NAME = "nou_tube_orientation"
  private const val FORCE_LANDSCAPE = "forceLandscape"

  fun restore(context: Context) {
    nouOrientationPolicy.initialize {
      context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getBoolean(FORCE_LANDSCAPE, false)
    }
  }

  fun save(context: Context, forceLandscape: Boolean) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit()
      .putBoolean(FORCE_LANDSCAPE, forceLandscape).apply()
  }
}

// Expo autolinking discovers *Package.kt independently of JS module creation.
// Restore at activity creation so a cold launch does not wait for JS settings.
class NouOrientationPackage : BasePackage() {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(object : ReactActivityLifecycleListener {
      private fun restore(activity: Activity) {
        NouOrientationPreferences.restore(activity)
        nouOrientationPolicy.reapplyForced { activity.requestedOrientation = it }
      }

      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) = restore(activity)

      override fun onResume(activity: Activity) = restore(activity)
    })
}
