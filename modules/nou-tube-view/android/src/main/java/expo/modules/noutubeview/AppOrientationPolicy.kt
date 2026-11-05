package expo.modules.noutubeview

import android.content.pm.ActivityInfo

// All access is on the UI thread. The app preference outranks the temporary
// fullscreen request, including its sensor-driven release and window policy.
internal class AppOrientationPolicy {
  var forceLandscape = false
    private set
  private var initialized = false
  private var fullscreenOwner: Any? = null
  private var restoreFullscreen: (() -> Unit)? = null

  fun initialize(readForceLandscape: () -> Boolean) {
    if (initialized) return
    forceLandscape = readForceLandscape()
    initialized = true
  }

  fun orientationFor(orientation: Int = ActivityInfo.SCREEN_ORIENTATION_USER): Int =
    if (forceLandscape) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else orientation

  fun update(forceLandscape: Boolean, applyOrientation: (Int) -> Unit) {
    initialized = true
    if (this.forceLandscape == forceLandscape) return
    this.forceLandscape = forceLandscape
    val restore = restoreFullscreen
    if (restore != null) restore() else applyOrientation(orientationFor())
  }

  fun fullscreen(owner: Any, restore: () -> Unit) {
    fullscreenOwner = owner
    restoreFullscreen = restore
  }

  fun exitFullscreen(owner: Any) {
    if (fullscreenOwner !== owner) return
    fullscreenOwner = null
    restoreFullscreen = null
  }

  fun reapplyForced(applyOrientation: (Int) -> Unit) {
    // Do not re-lock a normal fullscreen session after its sensor released it.
    if (forceLandscape) applyOrientation(orientationFor())
  }
}

internal val nouOrientationPolicy = AppOrientationPolicy()
