package expo.modules.noutubeview

import android.content.pm.ActivityInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class FullscreenOrientationTest {
  @Test
  fun portraitVideoKeepsUserOrientation() {
    assertEquals(
      ActivityInfo.SCREEN_ORIENTATION_USER,
      fullscreenOrientationFor(FULLSCREEN_PORTRAIT_VIDEO)
    )
  }

  @Test
  fun explicitLandscapeRequestUsesSensorLandscape() {
    assertEquals(
      ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
      fullscreenOrientationFor(FULLSCREEN_LANDSCAPE_EXPLICIT)
    )
  }

  @Test
  fun gestureFullscreenKeepsUserOrientation() {
    assertEquals(
      ActivityInfo.SCREEN_ORIENTATION_USER,
      fullscreenOrientationFor(FULLSCREEN_LANDSCAPE_GESTURE)
    )
  }
}
