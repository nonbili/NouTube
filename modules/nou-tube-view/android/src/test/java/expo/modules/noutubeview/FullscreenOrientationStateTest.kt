package expo.modules.noutubeview

import android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
import android.content.pm.ActivityInfo.SCREEN_ORIENTATION_USER
import android.graphics.Rect
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowLayoutInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class FullscreenOrientationStateTest {
  private fun fold(state: FoldingFeature.State) = WindowLayoutInfo(listOf(object : FoldingFeature {
    override val state = state
    override val bounds: Rect get() = error("Orientation policy does not use bounds")
    override val isSeparating = false
    override val occlusionType = FoldingFeature.OcclusionType.NONE
    override val orientation = FoldingFeature.Orientation.HORIZONTAL
  }))

  @Test
  fun foldingAndUnfoldingDuringExplicitFullscreenReappliesOrientation() {
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(it) }
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    session.onWindowLayoutChanged(fold(FoldingFeature.State.HALF_OPENED))
    session.onWindowLayoutChanged(fold(FoldingFeature.State.FLAT))
    assertEquals(listOf(SCREEN_ORIENTATION_SENSOR_LANDSCAPE, SCREEN_ORIENTATION_USER,
      SCREEN_ORIENTATION_SENSOR_LANDSCAPE), requests)
  }

  @Test
  fun fullscreenEnteredInSplitScreenLocksLandscapeWhenReturningToFullWindow() {
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(it) }
    session.onMultiWindowModeChanged(true)
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    session.onMultiWindowModeChanged(false)
    session.onMultiWindowModeChanged(true)
    assertEquals(listOf(SCREEN_ORIENTATION_USER, SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
      SCREEN_ORIENTATION_USER), requests)
  }

  @Test
  fun leavingSplitScreenWhileHalfOpenedKeepsUserOrientation() {
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(it) }
    session.onWindowLayoutChanged(fold(FoldingFeature.State.HALF_OPENED))
    session.onMultiWindowModeChanged(true)
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    session.onMultiWindowModeChanged(false)
    assertEquals(listOf(SCREEN_ORIENTATION_USER), requests)
    session.onWindowLayoutChanged(WindowLayoutInfo(emptyList()))
    assertEquals(listOf(SCREEN_ORIENTATION_USER, SCREEN_ORIENTATION_SENSOR_LANDSCAPE), requests)
  }

  @Test
  fun windowCallbacksAfterFullscreenExitDoNotRequestOrientation() {
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(it) }
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    session.exit()
    session.onMultiWindowModeChanged(true)
    session.onWindowLayoutChanged(fold(FoldingFeature.State.HALF_OPENED))
    session.onMultiWindowModeChanged(false)
    session.onWindowLayoutChanged(fold(FoldingFeature.State.FLAT))
    assertEquals(listOf(SCREEN_ORIENTATION_SENSOR_LANDSCAPE), requests)
  }

  @Test
  fun pictureInPictureFullscreenExitDoesNotRelockOnReturn() {
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(it) }
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    session.onMultiWindowModeChanged(true)
    // The PiP content script exits WebView fullscreen when PiP starts.
    session.exit()
    session.onMultiWindowModeChanged(false)
    assertEquals(listOf(SCREEN_ORIENTATION_SENSOR_LANDSCAPE, SCREEN_ORIENTATION_USER), requests)
  }

  @Test
  fun unchangedWindowReportsDoNotRelockOrientation() {
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(it) }
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    session.onWindowLayoutChanged(fold(FoldingFeature.State.FLAT))
    session.onMultiWindowModeChanged(false)
    session.onWindowLayoutChanged(WindowLayoutInfo(emptyList()))
    assertEquals(listOf(SCREEN_ORIENTATION_SENSOR_LANDSCAPE), requests)
  }

  @Test
  fun gestureAndPortraitSessionsStayUserOrientedAcrossWindowChanges() {
    for (mode in listOf(FULLSCREEN_LANDSCAPE_GESTURE, FULLSCREEN_PORTRAIT_VIDEO)) {
      val requests = mutableListOf<Int>()
      val session = FullscreenOrientationState { requests.add(it) }
      session.enter(mode)
      session.onWindowLayoutChanged(fold(FoldingFeature.State.HALF_OPENED))
      session.onMultiWindowModeChanged(true)
      session.onWindowLayoutChanged(fold(FoldingFeature.State.FLAT))
      session.onMultiWindowModeChanged(false)
      assertEquals(listOf(SCREEN_ORIENTATION_USER), requests)
    }
  }
}
