package expo.modules.noutubeview

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Binder
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.session.MediaButtonReceiver
import java.net.URL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NouService : Service() {
  private var webView: NouWebView? = null
  private val binder = NouBinder()
  private var mediaSession: MediaSessionCompat? = null
  private var notificationManager: NotificationManager? = null
  private var activity: Activity? = null
  private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
  private val NOTIFICATION_ID = 777
  private val CHANNEL_ID = "noutube"

  inner class NouBinder : Binder() {
    fun getService(): NouService = this@NouService
  }

  override fun onBind(intent: Intent): IBinder = binder

  fun initialize(view: NouWebView, _activity: Activity) {
    activity = _activity
    webView = view
    mediaSession = MediaSessionCompat(this, "NouService")
    initCallback()
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
    val metadata = session.getController().getMetadata()
    val title = metadata.getString(MediaMetadataCompat.METADATA_KEY_TITLE)
    val author = metadata.getString(MediaMetadataCompat.METADATA_KEY_AUTHOR)
    val largeIcon = metadata.getBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART)
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
      .addAction(android.R.drawable.ic_media_next, "Previous", nextActionIntent)
      .setStyle(
        androidx.media.app.NotificationCompat.MediaStyle()
          .setMediaSession(mediaSession!!.getSessionToken())
          .setShowActionsInCompactView(0, 1, 2)
      )
    return builder.build()
  }

  fun setPlaybackState(playing: Boolean, pos: Long = 0) {
    val state =
      PlaybackStateCompat.Builder()
        .setActions(
          PlaybackStateCompat.ACTION_PLAY_PAUSE
            or PlaybackStateCompat.ACTION_PLAY
            or PlaybackStateCompat.ACTION_PAUSE
            or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
        )
        .setState(
          if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
          pos * 1000,
          1.0f
        )
        .build()
    mediaSession?.setPlaybackState(state)
  }

  fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
    val metadataBuilder = MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
      .putString(MediaMetadataCompat.METADATA_KEY_AUTHOR, author)
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
    val notification = buildNotification()
    if (notificationManager == null) {
      val channel = NotificationChannel(CHANNEL_ID, "NouTube", NotificationManager.IMPORTANCE_LOW)
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC)

      notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager?.createNotificationChannel(channel)
      startForeground(NOTIFICATION_ID, notification)
    }
    notificationManager?.notify(
      NOTIFICATION_ID,
      notification
    )
  }

  fun notifyProgress(playing: Boolean, pos: Long) {
    val statePlaying = mediaSession?.getController()?.getPlaybackState()?.state == PlaybackStateCompat.STATE_PLAYING
    setPlaybackState(playing, pos)
    if (statePlaying != playing) {
      notificationManager?.notify(NOTIFICATION_ID, buildNotification())
    }
  }
}
