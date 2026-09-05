package expo.modules.noutubeview

import android.content.Context
import android.os.SystemClock
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

typealias LogFn = (String) -> Unit
typealias SleepTimerEventFn = (Map<String, Any?>) -> Unit
typealias DesktopModeEventFn = (Boolean) -> Unit

private const val SLEEP_TIMER_REASON_SET = "set"
private const val SLEEP_TIMER_REASON_CLEAR = "clear"
private const val SLEEP_TIMER_REASON_EXPIRED = "expired"

class NouSettings : Record {
  @Field
  val proxyEnabled: Boolean = false

  @Field
  val proxyType: String = "http"

  @Field
  val proxyHost: String = ""

  @Field
  val proxyPort: String = ""

  @Field
  val showMediaNotificationPrevButton: Boolean = true

  @Field
  val showMediaNotificationNextButton: Boolean = true

  @Field
  val showMediaNotificationRewindButton: Boolean = true

  @Field
  val showMediaNotificationForwardButton: Boolean = true

  @Field
  val showMediaNotificationSpeedButton: Boolean = false

  @Field
  val showMediaNotificationCloseButton: Boolean = false

  @Field
  val playbackRate: Double = 1.0
}

// Which buttons the media notification and the system media controls carry.
// The service reads this on every rebuild, so a settings change only has to
// flip the flags and ask for a refresh. Every button is its own flag because
// the shade only draws four of them, which is too tight a budget to spend on
// pairs (see buildNotification).
object NouMediaButtons {
  var showPrev = true
  var showNext = true
  var showRewind = true
  var showForward = true
  var showSpeed = false
  var showClose = false
  // Kept in sync from JS so the speed button can pick the next rate without an
  // eval round-trip; the page stays the source of truth.
  var playbackRate = 1.0

  // True when a button appeared or disappeared, which is what forces the
  // notification and the playback state to be rebuilt. A rate change counts
  // only while the speed button is on, because that button draws the rate.
  fun update(settings: NouSettings): Boolean {
    val changed = showPrev != settings.showMediaNotificationPrevButton ||
      showNext != settings.showMediaNotificationNextButton ||
      showRewind != settings.showMediaNotificationRewindButton ||
      showForward != settings.showMediaNotificationForwardButton ||
      showSpeed != settings.showMediaNotificationSpeedButton ||
      showClose != settings.showMediaNotificationCloseButton ||
      (settings.showMediaNotificationSpeedButton && playbackRate != settings.playbackRate)
    showPrev = settings.showMediaNotificationPrevButton
    showNext = settings.showMediaNotificationNextButton
    showRewind = settings.showMediaNotificationRewindButton
    showForward = settings.showMediaNotificationForwardButton
    showSpeed = settings.showMediaNotificationSpeedButton
    showClose = settings.showMediaNotificationCloseButton
    playbackRate = settings.playbackRate
    return changed
  }
}

class NouController {
  internal var service: NouService? = null
  internal var logFn: LogFn? = null
  internal var sleepTimerEventFn: SleepTimerEventFn? = null
  internal var desktopModeEventFn: DesktopModeEventFn? = null
  internal var i18nStrings = mutableMapOf<String, String>()
  private var lastDesktopMode: Boolean? = null
  private var pendingSleepTimerDeadlineMs: Long? = null
  private var hasPendingSleepTimerChange = false

  fun log(msg: String) {
    logFn?.invoke(msg)
  }

  /**
   * Called by MainActivity whenever its display or configuration changes, so
   * moving the window between the phone screen and an external monitor reaches
   * JS without polling.
   */
  fun updateDesktopMode(context: Context) {
    val desktopMode = isSystemDesktopMode(context)
    if (desktopMode == lastDesktopMode) {
      return
    }
    lastDesktopMode = desktopMode
    desktopModeEventFn?.invoke(desktopMode)
  }

  fun t(key: String): String {
    return i18nStrings[key] ?: "Missed translation: $key"
  }

  fun setSleepTimer(durationMs: Long) {
    val nextDeadlineMs = SystemClock.elapsedRealtime() + durationMs
    val currentService = service
    if (currentService != null) {
      currentService.setSleepTimerDeadline(nextDeadlineMs)
      return
    }
    pendingSleepTimerDeadlineMs = nextDeadlineMs
    hasPendingSleepTimerChange = true
  }

  fun clearSleepTimer() {
    val currentService = service
    if (currentService != null) {
      currentService.clearSleepTimer(false)
      return
    }
    pendingSleepTimerDeadlineMs = null
    hasPendingSleepTimerChange = true
  }

  fun getSleepTimerRemainingMs(): Long? {
    val currentService = service
    if (currentService != null) {
      return currentService.getSleepTimerRemainingMs()
    }

    val pendingDeadlineMs = pendingSleepTimerDeadlineMs ?: return null
    return maxOf(0L, pendingDeadlineMs - SystemClock.elapsedRealtime())
  }

  fun applyPendingSleepTimer() {
    if (!hasPendingSleepTimerChange) {
      return
    }

    val currentService = service ?: return
    hasPendingSleepTimerChange = false
    val pendingDeadlineMs = pendingSleepTimerDeadlineMs
    pendingSleepTimerDeadlineMs = null
    if (pendingDeadlineMs != null) {
      currentService.setSleepTimerDeadline(pendingDeadlineMs)
    } else {
      currentService.clearSleepTimer(false)
    }
  }

  fun emitSleepTimer(remainingMs: Long?, reason: String) {
    sleepTimerEventFn?.invoke(
      mapOf(
        "remainingMs" to remainingMs,
        "reason" to reason,
      ),
    )
  }

  fun emitSleepTimerSet(remainingMs: Long?) {
    emitSleepTimer(remainingMs, SLEEP_TIMER_REASON_SET)
  }

  fun emitSleepTimerCleared() {
    emitSleepTimer(null, SLEEP_TIMER_REASON_CLEAR)
  }

  fun emitSleepTimerExpired() {
    emitSleepTimer(null, SLEEP_TIMER_REASON_EXPIRED)
  }

  fun exit() {
    service?.exit()
  }

  fun refreshMediaNotification() {
    service?.refreshNotification()
  }
}

val nouController = NouController()
