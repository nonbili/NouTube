package expo.modules.noutubeview

import android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
import android.content.pm.ActivityInfo.SCREEN_ORIENTATION_USER
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class AppOrientationPolicyTest {
  @Test
  fun initializationRestoresLandscapeBeforeSettingsArrive() {
    val policy = AppOrientationPolicy()
    policy.initialize { true }
    assertEquals(SCREEN_ORIENTATION_SENSOR_LANDSCAPE, policy.orientationFor())
    policy.reapplyForced { assertEquals(SCREEN_ORIENTATION_SENSOR_LANDSCAPE, it) }
    policy.initialize { error("Resume must not reload or override the live policy") }
  }

  @Test
  fun disabledInitializationPreservesNormalOrientation() {
    val policy = AppOrientationPolicy()
    policy.initialize { false }
    assertFalse(policy.forceLandscape)
    policy.reapplyForced { error("Disabled startup must not request orientation") }
  }

  @Test
  fun settingsUpdateWinsOverLateInitialization() {
    val policy = AppOrientationPolicy()
    policy.update(false) { error("Unchanged preference must not request orientation") }
    policy.initialize { error("Late module initialization must not overwrite settings") }
    assertFalse(policy.forceLandscape)
  }

  @Test
  fun defaultsToNormalOrientationAndDoesNotReapplyWhenDisabled() {
    val policy = AppOrientationPolicy()
    assertFalse(policy.forceLandscape)
    assertEquals(SCREEN_ORIENTATION_USER, policy.orientationFor())
    policy.reapplyForced { error("Disabled policy must not re-lock fullscreen") }
    policy.update(false) { error("Unchanged settings must not reset fullscreen") }
  }

  @Test
  fun forcingLandscapeOverridesNormalAndSensorReleaseRequests() {
    val policy = AppOrientationPolicy()
    val requests = mutableListOf<Int>()
    policy.update(true) { requests.add(it) }
    assertEquals(SCREEN_ORIENTATION_SENSOR_LANDSCAPE, policy.orientationFor(SCREEN_ORIENTATION_USER))
    policy.reapplyForced { requests.add(it) }
    policy.update(false) { requests.add(it) }
    assertEquals(listOf(SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
      SCREEN_ORIENTATION_SENSOR_LANDSCAPE, SCREEN_ORIENTATION_USER), requests)
  }

  @Test
  fun disablingDuringFullscreenRestoresEachExistingFullscreenChoice() {
    for (mode in listOf(FULLSCREEN_LANDSCAPE_EXPLICIT, FULLSCREEN_LANDSCAPE_GESTURE,
      FULLSCREEN_PORTRAIT_VIDEO)) {
      val policy = AppOrientationPolicy()
      val requests = mutableListOf<Int>()
      val owner = Any()
      val session = FullscreenOrientationState { requests.add(policy.orientationFor(it)) }
      policy.fullscreen(owner) { session.reapply() }
      session.enter(mode)
      policy.update(true) { error("Fullscreen must restore through its own policy") }
      policy.update(false) { error("Fullscreen must restore through its own policy") }
      assertEquals(listOf(fullscreenOrientationFor(mode), SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
        fullscreenOrientationFor(mode)), requests)
    }
  }

  @Test
  fun forcedLandscapeWinsWindowChangesButDisablingRestoresMultiWindowPolicy() {
    val policy = AppOrientationPolicy()
    val requests = mutableListOf<Int>()
    val session = FullscreenOrientationState { requests.add(policy.orientationFor(it)) }
    policy.fullscreen(Any()) { session.reapply() }
    session.enter(FULLSCREEN_LANDSCAPE_EXPLICIT)
    policy.update(true) { requests.add(it) }
    session.onMultiWindowModeChanged(true)
    policy.update(false) { requests.add(it) }
    assertEquals(listOf(SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
      SCREEN_ORIENTATION_SENSOR_LANDSCAPE, SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
      SCREEN_ORIENTATION_USER), requests)
  }

  @Test
  fun fullscreenExitKeepsAppLandscapeAndClearsOnlyItsOwnSession() {
    val policy = AppOrientationPolicy()
    val owner = Any()
    var restores = 0
    policy.fullscreen(owner) { restores++ }
    policy.exitFullscreen(Any())
    policy.update(true) { error("Another view must not clear fullscreen") }
    assertEquals(1, restores)
    policy.exitFullscreen(owner)
    assertEquals(SCREEN_ORIENTATION_SENSOR_LANDSCAPE, policy.orientationFor())
    policy.update(false) { assertEquals(SCREEN_ORIENTATION_USER, it) }
    assertEquals(1, restores)
  }
}
