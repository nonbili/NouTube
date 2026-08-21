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
  private var lastForegroundAssertMs = 0L
  private val NOTIFICATION_ID = 777
  private val CHANNEL_ID = "noutube"
  private val FOREGROUND_REASSERT_INTERVAL_MS = 60_000L

  inner class NouBinder : Binder() {
    fun getService(): NouService = this@NouService
  }

  override fun onBind(intent: Intent): IBinder = binder

  // The intent is null when the service is restarted by the system.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent != null) {
      MediaButtonReceiver.handleIntent(mediaSession, intent)
    }
    // Never restart a dead process just for this service: without the activity
    // and its WebView there is nothing to play. While the activity lives, its
    // BIND_AUTO_CREATE binding recreates the service on demand anyway.
    return START_NOT_STICKY
  }

  fun initialize(view: NouWebView, _activity: Activity) {
    activity = _activity
    webView = view
    mediaSession = MediaSessionCompat(this, "NouService")
    initCallback()

    val filter = IntentFilter()
    filter.addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
    filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
    val noisyReceiver = NoisyAudioReceiver(view)
    _activity.registerReceiver(noisyReceiver, filter)
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

      override fun onSeekTo(pos: Long) {
        val seconds = maxOf(0L, pos) / 1000.0
        webView?.evaluateJavascript("NouTube.seekTo($seconds)", null)
      }

      override fun onCustomAction(action: String?, extras: Bundle?) {
        when (action) {
          "Rewind" -> webView?.evaluateJavascript("NouTube.seekBy(-10)", null)
          "Forward" -> webView?.evaluateJavascript("NouTube.seekBy(30)", null)
        }
      }
    }
    mediaSession?.setCallback(callback)
    mediaSession?.setActive(true)
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

    val statePlaying = mediaSession?.getController()?.getPlaybackState()?.state == PlaybackStateCompat.STATE_PLAYING
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.icon)
      .setLargeIcon(largeIcon)
      .setContentTitle(title)
      .setContentText(author)
      .setContentIntent(getContentIntent())
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .addAction(android.R.drawable.ic_media_previous, "Previous", prevActionIntent)
      .addAction(
        if (statePlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
        "Pause",
        playActionIntent
      )
      .addAction(android.R.drawable.ic_media_next, "Next", nextActionIntent)
      .setStyle(
        androidx.media.app.NotificationCompat.MediaStyle()
          .setMediaSession(mediaSession!!.getSessionToken())
          .setShowActionsInCompactView(0, 1, 2)
      )
    return builder.build()
  }

  fun setPlaybackState(playing: Boolean, pos: Long = 0) {
    if (stateBuilder == null) {
      stateBuilder = PlaybackStateCompat.Builder()
        .addCustomAction(
          PlaybackStateCompat.CustomAction.Builder("Rewind", "Rewind", R.drawable.rewind).build()
        )
        .addCustomAction(
          PlaybackStateCompat.CustomAction.Builder("Forward", "Forward", R.drawable.forward).build()
        )
        .setActions(
          PlaybackStateCompat.ACTION_PLAY_PAUSE
            or PlaybackStateCompat.ACTION_PLAY
            or PlaybackStateCompat.ACTION_PAUSE
            or PlaybackStateCompat.ACTION_SEEK_TO
            or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
        )
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
  private fun ensureForeground() {
    if (mediaSession == null) {
      return
    }
    val now = SystemClock.elapsedRealtime()
    if (now - lastForegroundAssertMs < FOREGROUND_REASSERT_INTERVAL_MS) {
      return
    }
    lastForegroundAssertMs = now
    try {
      ensureNotificationManager()
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      // ForegroundServiceStartNotAllowedException and friends: keep playing,
      // retry on the next tick after the interval or when the app is
      // foregrounded again.
      nouController.log("startForeground failed: ${e.message}")
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
    notificationManager?.notify(
      NOTIFICATION_ID,
      buildNotification()
    )
  }

  fun notifyProgress(playing: Boolean, pos: Long) {
    val statePlaying = mediaSession?.getController()?.getPlaybackState()?.state == PlaybackStateCompat.STATE_PLAYING
    setPlaybackState(playing, pos)
    if (playing) {
      ensureForeground()
    }
    if (statePlaying != playing) {
      notificationManager?.notify(NOTIFICATION_ID, buildNotification())
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
    stopForeground(STOP_FOREGROUND_REMOVE)
    lastForegroundAssertMs = 0L
    notificationManager?.cancel(NOTIFICATION_ID)
    notificationManager = null
    mediaSession?.setActive(false)
    mediaSession?.release()
    mediaSession = null
    stopSelf()
  }
}
