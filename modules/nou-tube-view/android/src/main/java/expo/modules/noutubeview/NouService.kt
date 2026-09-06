package expo.modules.noutubeview

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.BitmapFactory
import android.media.AudioManager
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.session.MediaButtonReceiver
import java.net.URL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// The speed button is a custom action, so it cannot ride on a media button
// intent the way play/pause and skip do; it gets its own service intent.
const val ACTION_CYCLE_PLAYBACK_RATE = "expo.modules.noutubeview.CYCLE_PLAYBACK_RATE"

// A single button can only walk one way through the rates, so keep the list
// short: the full set lives behind the toolbar's speed control.
private val PLAYBACK_RATE_CYCLE = listOf(1.0, 1.25, 1.5, 1.75, 2.0)

// The button shows the rate it is set to rather than a fixed icon, and a custom
// action's icon has to be a resource, so every rate the toolbar offers has one
// drawn for it. Anything in between (a rate the page picked on its own) falls
// back to the plain gauge.
private val PLAYBACK_RATE_ICONS = mapOf(
  0.25 to R.drawable.speed_025x,
  0.5 to R.drawable.speed_05x,
  0.75 to R.drawable.speed_075x,
  1.0 to R.drawable.speed_1x,
  1.25 to R.drawable.speed_125x,
  1.5 to R.drawable.speed_15x,
  1.75 to R.drawable.speed_175x,
  2.0 to R.drawable.speed_2x,
  2.5 to R.drawable.speed_25x,
  3.0 to R.drawable.speed_3x,
  3.5 to R.drawable.speed_35x,
  4.0 to R.drawable.speed_4x
)

private fun speedIcon(rate: Double): Int {
  val match = PLAYBACK_RATE_ICONS.keys.minByOrNull { kotlin.math.abs(it - rate) }
  if (match == null || kotlin.math.abs(match - rate) > 0.01) {
    return R.drawable.speed
  }
  return PLAYBACK_RATE_ICONS.getValue(match)
}

class NoisyAudioReceiver(private val view: NouWebView) : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY ||
      intent.action == BluetoothDevice.ACTION_ACL_DISCONNECTED
    ) {
      view.evaluateJavascript("NouTube.pause()", null)
    }
  }
}

class NouService : Service() {
  private lateinit var webView: NouWebView
  private val binder = NouBinder()
  private var mediaSession: MediaSessionCompat? = null
  private var notificationManager: NotificationManager? = null
  private var stateBuilder: PlaybackStateCompat.Builder? = null
  private var activity: Activity? = null
  private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
  private val mainHandler = Handler(Looper.getMainLooper())
  private var sleepTimerDeadlineMs: Long? = null
  private var sleepTimerRunnable: Runnable? = null
  private var lastForegroundAttemptMs = 0L
  private var hasAttemptedForeground = false
  private var noisyReceiver: NoisyAudioReceiver? = null
  private var notificationDismissed = false
  private val NOTIFICATION_ID = 777
  private val CHANNEL_ID = "noutube"
  private val FOREGROUND_REASSERT_INTERVAL_MS = 60_000L

  inner class NouBinder : Binder() {
    fun getService(): NouService = this@NouService
  }

  override fun onBind(intent: Intent): IBinder = binder

  // The intent is null when the service is restarted by the system.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Only media buttons arrive through startForegroundService; the plain
    // startService from NouTubeView.initService must fall through untouched or
    // it would stop the service it just started.
    if (intent?.action == Intent.ACTION_MEDIA_BUTTON) {
      // startForegroundService arms a 5s startForeground deadline on O+, and
      // the service may well be demoted at that point (that is the bug this
      // whole file works around), so promote it here instead of waiting for
      // the next progress tick, whose throttle could swallow the promotion.
      if (mediaSession == null) {
        // Already exited: nothing left to play, just satisfy the deadline.
        settleForegroundDeadline()
        stopSelf()
        return START_NOT_STICKY
      }
      // A dismissed notification has nothing to promote, but the deadline was
      // armed all the same, so it still has to be answered. Playing again
      // clears the dismissal and re-promotes on the next progress tick.
      if (notificationDismissed) {
        settleForegroundDeadline()
      } else {
        ensureForeground(force = true)
      }
      MediaButtonReceiver.handleIntent(mediaSession, intent)
    }
    if (intent?.action == ACTION_CYCLE_PLAYBACK_RATE && mediaSession != null) {
      cyclePlaybackRate()
    }
    // Never restart a dead process just for this service: without the activity
    // and its WebView there is nothing to play. While the activity lives, its
    // BIND_AUTO_CREATE binding recreates the service on demand anyway.
    return START_NOT_STICKY
  }

  // Called again whenever the activity rebinds (screen remount, service
  // recreation), so every resource taken here has to replace the previous one.
  fun initialize(view: NouWebView, _activity: Activity) {
    unregisterNoisyReceiver()
    activity = _activity
    webView = view
    mediaSession?.setActive(false)
    mediaSession?.release()
    mediaSession = MediaSessionCompat(this, "NouService")
    initCallback()

    val filter = IntentFilter()
    filter.addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
    filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
    val receiver = NoisyAudioReceiver(view)
    _activity.registerReceiver(receiver, filter)
    noisyReceiver = receiver
  }

  private fun unregisterNoisyReceiver() {
    val receiver = noisyReceiver ?: return
    noisyReceiver = null
    try {
      activity?.unregisterReceiver(receiver)
    } catch (e: IllegalArgumentException) {
      // Already unregistered with its activity.
    }
  }

  fun setSleepTimerDeadline(deadlineMs: Long) {
    val remainingMs = maxOf(0L, deadlineMs - SystemClock.elapsedRealtime())
    sleepTimerDeadlineMs = SystemClock.elapsedRealtime() + remainingMs
    sleepTimerRunnable?.let(mainHandler::removeCallbacks)
    val runnable = Runnable {
      sleepTimerRunnable = null
      sleepTimerDeadlineMs = null
      webView.evaluateJavascript("NouTube.pause()", null)
      nouController.emitSleepTimerExpired()
    }
    sleepTimerRunnable = runnable
    mainHandler.postDelayed(runnable, remainingMs)
    nouController.emitSleepTimerSet(getSleepTimerRemainingMs())
  }

  fun clearSleepTimer(emitEvent: Boolean = true) {
    sleepTimerRunnable?.let(mainHandler::removeCallbacks)
    sleepTimerRunnable = null
    sleepTimerDeadlineMs = null
    if (emitEvent) {
      nouController.emitSleepTimerCleared()
    }
  }

  fun getSleepTimerRemainingMs(): Long? {
    val deadlineMs = sleepTimerDeadlineMs ?: return null
    return maxOf(0L, deadlineMs - SystemClock.elapsedRealtime())
  }

  fun initCallback() {
    val callback = object : MediaSessionCompat.Callback() {
      override fun onPlay() {
        webView?.evaluateJavascript("NouTube.play()", null)
      }

      override fun onPause() {
        webView?.evaluateJavascript("NouTube.pause()", null)
      }

      override fun onSkipToPrevious() {
        webView?.evaluateJavascript("NouTube.prev()", null)
      }

      override fun onSkipToNext() {
        webView?.evaluateJavascript("NouTube.next()", null)
      }

      override fun onRewind() {
        webView?.evaluateJavascript("NouTube.seekBy(-10)", null)
      }

      override fun onFastForward() {
        webView?.evaluateJavascript("NouTube.seekBy(30)", null)
      }

      override fun onSeekTo(pos: Long) {
        val seconds = maxOf(0L, pos) / 1000.0
        webView?.evaluateJavascript("NouTube.seekTo($seconds)", null)
      }

      override fun onCustomAction(action: String?, extras: Bundle?) {
        when (action) {
          "Rewind" -> webView?.evaluateJavascript("NouTube.seekBy(-10)", null)
          "Forward" -> webView?.evaluateJavascript("NouTube.seekBy(30)", null)
          "Speed" -> cyclePlaybackRate()
          "Close" -> {
            webView.evaluateJavascript("NouTube.pause()", null)
            dismissNotification()
          }
        }
      }

      override fun onStop() {
        webView.evaluateJavascript("NouTube.pause()", null)
        dismissNotification()
      }
    }
    mediaSession?.setCallback(callback)
    mediaSession?.setActive(true)
  }

  // The rate JS reports back arrives through setSettings, but a second tap can
  // land before that round-trip finishes, so step the cached value here too.
  private fun cyclePlaybackRate() {
    val current = NouMediaButtons.playbackRate
    val next = PLAYBACK_RATE_CYCLE.firstOrNull { it > current + 0.01 } ?: PLAYBACK_RATE_CYCLE.first()
    NouMediaButtons.playbackRate = next
    webView.evaluateJavascript("NouTube.setPlaybackRate($next)", null)
    refreshNotification()
  }

  fun getContentIntent(): PendingIntent {
    val launchIntent = Intent(this, activity!!.javaClass)
    launchIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun buildNotification(): Notification {
    val session = mediaSession!!
    // Metadata is null when the service got restarted and no video change has
    // happened yet; the notification must still build so ensureForeground works.
    val metadata = session.getController().getMetadata()
    val title = metadata?.getString(MediaMetadataCompat.METADATA_KEY_TITLE) ?: "NouTube"
    val author = metadata?.getString(MediaMetadataCompat.METADATA_KEY_ARTIST) ?: ""
    val largeIcon = metadata?.getBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART)
    val playActionIntent =
      MediaButtonReceiver.buildMediaButtonPendingIntent(
        this,
        PlaybackStateCompat.ACTION_PLAY_PAUSE
      )
    val prevActionIntent =
      MediaButtonReceiver.buildMediaButtonPendingIntent(
        this,
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
      )
    val nextActionIntent =
      MediaButtonReceiver.buildMediaButtonPendingIntent(
        this,
        PlaybackStateCompat.ACTION_SKIP_TO_NEXT
      )
    val stopActionIntent =
      MediaButtonReceiver.buildMediaButtonPendingIntent(
        this,
        PlaybackStateCompat.ACTION_STOP
      )
    val rewindActionIntent =
      MediaButtonReceiver.buildMediaButtonPendingIntent(
        this,
        PlaybackStateCompat.ACTION_REWIND
      )
    val forwardActionIntent =
      MediaButtonReceiver.buildMediaButtonPendingIntent(
        this,
        PlaybackStateCompat.ACTION_FAST_FORWARD
      )
    val speedActionIntent = PendingIntent.getService(
      this,
      1,
      Intent(this, NouService::class.java).setAction(ACTION_CYCLE_PLAYBACK_RATE),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val statePlaying = mediaSession?.getController()?.getPlaybackState()?.state == PlaybackStateCompat.STATE_PLAYING
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.icon)
      .setLargeIcon(largeIcon)
      .setContentTitle(title)
      .setContentText(author)
      .setContentIntent(getContentIntent())
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)

    // The compact view takes action indices, not actions, so collecting them
    // while the buttons go in is what keeps play/pause centred no matter which
    // of the optional buttons are on.
    val compactActions = mutableListOf<Int>()
    var actionIndex = 0
    if (NouMediaButtons.showPrev) {
      builder.addAction(android.R.drawable.ic_media_previous, "Previous", prevActionIntent)
      compactActions.add(actionIndex++)
    }
    builder.addAction(
      if (statePlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
      "Pause",
      playActionIntent
    )
    compactActions.add(actionIndex++)
    if (NouMediaButtons.showNext) {
      builder.addAction(android.R.drawable.ic_media_next, "Next", nextActionIntent)
      compactActions.add(actionIndex)
    }
    // Below Android 13 the shade renders these actions and ignores the
    // session's custom ones, so every optional button needs an entry here too.
    // None of them goes in the compact view, so they need no index; the order
    // is the settings order, which is the order they get dropped in when there
    // are more buttons on than the shade will draw.
    if (NouMediaButtons.showRewind) {
      builder.addAction(R.drawable.rewind, "Rewind", rewindActionIntent)
    }
    if (NouMediaButtons.showForward) {
      builder.addAction(R.drawable.forward, "Forward", forwardActionIntent)
    }
    if (NouMediaButtons.showSpeed) {
      builder.addAction(speedIcon(NouMediaButtons.playbackRate), "Speed", speedActionIntent)
    }
    if (NouMediaButtons.showClose) {
      builder.addAction(R.drawable.close, "Close", stopActionIntent)
    }
    builder.setStyle(
      androidx.media.app.NotificationCompat.MediaStyle()
        .setMediaSession(mediaSession!!.getSessionToken())
        .setShowActionsInCompactView(*compactActions.toIntArray())
    )
    return builder.build()
  }

  fun setPlaybackState(playing: Boolean, pos: Long = 0) {
    if (stateBuilder == null) {
      val builder = PlaybackStateCompat.Builder()
      // Android 13+ builds the shade's controls from the session rather than
      // from the notification's own actions: Previous and Next take their own
      // slots, the custom actions below fill what is left, and on a Pixel that
      // is four buttons in total next to the seek bar. So the order here is the
      // settings order, and whatever does not fit falls off the end.
      if (NouMediaButtons.showRewind) {
        builder.addCustomAction(
          PlaybackStateCompat.CustomAction.Builder("Rewind", "Rewind", R.drawable.rewind).build()
        )
      }
      if (NouMediaButtons.showForward) {
        builder.addCustomAction(
          PlaybackStateCompat.CustomAction.Builder("Forward", "Forward", R.drawable.forward).build()
        )
      }
      if (NouMediaButtons.showSpeed) {
        builder.addCustomAction(
          PlaybackStateCompat.CustomAction.Builder(
            "Speed",
            "Speed",
            speedIcon(NouMediaButtons.playbackRate)
          ).build()
        )
      }
      // ACTION_STOP gets no slot of its own up there, so Close only shows as a
      // custom action. Below 13 the notification action is what renders, and
      // adding it here too would double it up.
      if (NouMediaButtons.showClose && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        builder.addCustomAction(
          PlaybackStateCompat.CustomAction.Builder("Close", "Close", R.drawable.close).build()
        )
      }
      var actions = PlaybackStateCompat.ACTION_PLAY_PAUSE or
        PlaybackStateCompat.ACTION_PLAY or
        PlaybackStateCompat.ACTION_PAUSE or
        PlaybackStateCompat.ACTION_SEEK_TO
      if (NouMediaButtons.showPrev) {
        actions = actions or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
      }
      if (NouMediaButtons.showNext) {
        actions = actions or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
      }
      if (NouMediaButtons.showRewind) {
        actions = actions or PlaybackStateCompat.ACTION_REWIND
      }
      if (NouMediaButtons.showForward) {
        actions = actions or PlaybackStateCompat.ACTION_FAST_FORWARD
      }
      if (NouMediaButtons.showClose) {
        actions = actions or PlaybackStateCompat.ACTION_STOP
      }
      stateBuilder = builder.setActions(actions)
    }
    val state = stateBuilder!!.setState(
      if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
      pos * 1000,
      1.0f
    )
      .build()
    mediaSession?.setPlaybackState(state)
  }

  private fun ensureNotificationManager() {
    if (notificationManager == null) {
      val channel = NotificationChannel(CHANNEL_ID, "NouTube", NotificationManager.IMPORTANCE_LOW)
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC)

      notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager?.createNotificationChannel(channel)
    }
  }

  // The system can silently drop the service's foreground state while the app
  // is in the background (observed on Android 17: FOREGROUND_SERVICE_STOP
  // ~18min after backgrounding, with the process and binding alive). A cached
  // app playing audio is then fair game for the background-CPU killer, which
  // ends up shooting the WebView renderer mid-playback (#309, #146, #206).
  // The demotion happens without any callback, so while playback is running,
  // re-assert the foreground state at least once a minute.
  private fun ensureForeground(force: Boolean = false) {
    if (mediaSession == null || notificationDismissed) {
      return
    }
    val now = SystemClock.elapsedRealtime()
    // Throttle attempts, not successes: a service the system keeps refusing to
    // promote would otherwise rebuild a notification and log on every progress
    // tick. The flag is what gates the first attempt, because elapsedRealtime
    // is time since boot and would be under the interval right after one.
    if (!force &&
      hasAttemptedForeground &&
      now - lastForegroundAttemptMs < FOREGROUND_REASSERT_INTERVAL_MS
    ) {
      return
    }
    hasAttemptedForeground = true
    lastForegroundAttemptMs = now
    try {
      ensureNotificationManager()
      startForegroundNow(buildNotification())
    } catch (e: Exception) {
      // ForegroundServiceStartNotAllowedException and friends: keep playing,
      // retry on the next tick after the interval or when the app is
      // foregrounded again.
      nouController.log("startForeground failed: ${e.message}")
    }
  }

  // A settings change adds or drops buttons, so both the cached state builder
  // and the posted notification have to be rebuilt from the current state.
  fun refreshNotification() {
    if (mediaSession == null) {
      return
    }
    stateBuilder = null
    val playbackState = mediaSession?.getController()?.getPlaybackState()
    setPlaybackState(
      playbackState?.state == PlaybackStateCompat.STATE_PLAYING,
      (playbackState?.position ?: 0L) / 1000
    )
    postNotification()
  }

  private fun postNotification() {
    if (mediaSession == null || notificationDismissed) {
      return
    }
    notificationManager?.notify(NOTIFICATION_ID, buildNotification())
  }

  // The Close action only takes the player off the shade; the service and its
  // session stay around so playback resumed from the app can bring the
  // notification back. The pause it triggers arrives as a progress tick, which
  // would re-post the notification straight away, so posting stays blocked
  // until playback actually starts again.
  private fun dismissNotification() {
    notificationDismissed = true
    mediaSession?.setActive(false)
    stopForeground(STOP_FOREGROUND_REMOVE)
    notificationManager?.cancel(NOTIFICATION_ID)
    lastForegroundAttemptMs = 0L
    hasAttemptedForeground = false
  }

  private fun startForegroundNow(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  // A startForegroundService that arrives after exit() still has to be
  // answered with a startForeground call, or the system kills the process.
  // There is no session to build a media notification from, so show nothing
  // and drop it again right away.
  private fun settleForegroundDeadline() {
    try {
      ensureNotificationManager()
      startForegroundNow(
        NotificationCompat.Builder(this, CHANNEL_ID)
          .setSmallIcon(R.drawable.icon)
          .setContentTitle("NouTube")
          .build()
      )
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (e: Exception) {
      nouController.log("settleForegroundDeadline failed: ${e.message}")
    }
  }

  fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
    val metadataBuilder = MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, author)
      .putLong(
        MediaMetadataCompat.METADATA_KEY_DURATION,
        seconds * 1000
      )
    if (thumbnail != "") {
      scope.launch {
        val stream = URL(thumbnail).openStream()
        val largeIcon = BitmapFactory.decodeStream(stream)
        val metadata = metadataBuilder.putBitmap(
          MediaMetadataCompat.METADATA_KEY_ALBUM_ART,
          largeIcon
        )
          .build()
        mediaSession?.setMetadata(metadata)
      }
    }
    mediaSession?.setMetadata(metadataBuilder.build())
    ensureForeground()
    postNotification()
  }

  fun notifyProgress(playing: Boolean, pos: Long) {
    val statePlaying = mediaSession?.getController()?.getPlaybackState()?.state == PlaybackStateCompat.STATE_PLAYING
    setPlaybackState(playing, pos)
    if (playing) {
      // Playing again after a Close: bring the session and the notification back.
      if (notificationDismissed) {
        notificationDismissed = false
        mediaSession?.setActive(true)
      }
      ensureForeground()
    }
    if (statePlaying != playing) {
      postNotification()
    }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // The service is started (not only bound), so swiping the app away no
    // longer stops it implicitly. Mirror the old behavior: no app, no player.
    exit()
    super.onTaskRemoved(rootIntent)
  }

  fun exit() {
    clearSleepTimer(false)
    notificationDismissed = false
    unregisterNoisyReceiver()
    stopForeground(STOP_FOREGROUND_REMOVE)
    lastForegroundAttemptMs = 0L
    hasAttemptedForeground = false
    notificationManager?.cancel(NOTIFICATION_ID)
    notificationManager = null
    mediaSession?.setActive(false)
    mediaSession?.release()
    mediaSession = null
    stopSelf()
  }
}
