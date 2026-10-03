package expo.modules.noutubeview

import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowLayoutInfo

// Both window callbacks use the same session policy. An explicit request resumes
// its landscape lock when the phone is flat and the activity is full-window.
internal class FullscreenOrientationState(private val applyOrientation: (Int) -> Unit) {
  private var mode: Int? = null
  private var halfOpened = false
  private var multiWindow = false

  fun enter(mode: Int) {
    this.mode = mode
    applyOrientation(fullscreenOrientationFor(mode, halfOpened || multiWindow))
  }

  fun exit() {
    mode = null
  }

  fun onWindowLayoutChanged(info: WindowLayoutInfo) {
    updateWindow(info.displayFeatures.filterIsInstance<FoldingFeature>().any {
      it.state == FoldingFeature.State.HALF_OPENED
    }, multiWindow)
  }

  fun onMultiWindowModeChanged(multiWindow: Boolean) {
    updateWindow(halfOpened, multiWindow)
  }

  private fun updateWindow(halfOpened: Boolean, multiWindow: Boolean) {
    val previousPreserve = this.halfOpened || this.multiWindow
    this.halfOpened = halfOpened
    this.multiWindow = multiWindow
    val mode = mode ?: return
    val previous = fullscreenOrientationFor(mode, previousPreserve)
    val orientation = fullscreenOrientationFor(mode, halfOpened || multiWindow)
    // Repeated layout reports must not re-lock orientation after the sensor
    // listener has released it, or restart the listener for an unchanged policy.
    if (orientation != previous) applyOrientation(orientation)
  }
}
