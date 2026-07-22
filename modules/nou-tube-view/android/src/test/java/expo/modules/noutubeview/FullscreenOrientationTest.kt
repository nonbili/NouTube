package expo.modules.noutubeview

import android.content.pm.ActivityInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class FullscreenOrientationTest {
  @Test
  fun portraitVideoKeepsUserOrientation() {
    assertEquals(
      ActivityInfo.SCREEN_ORIENTATION_USER,
      fullscreenOrientationFor(isPortrait = true)
    )
  }

  @Test
  fun landscapeVideoUsesSensorLandscape() {
    assertEquals(
      ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
      fullscreenOrientationFor(isPortrait = false)
    )
  }
}
