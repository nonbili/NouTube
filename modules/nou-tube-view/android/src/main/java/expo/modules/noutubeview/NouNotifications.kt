package expo.modules.noutubeview

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

// Notifications posted without expo-notifications, which the F-Droid build goes without: it
// brings in Firebase. Tapping one launches NouTube with EXTRA_FEED, which the module turns into
// a feedNotificationOpened event.
object NouNotifications {
  const val EXTRA_FEED = "jp.nonbili.noutube.FEED_NOTIFICATION"

  fun areEnabled(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun post(context: Context, channelId: String, channelName: String, id: Int, title: String, body: String): Boolean {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT)
      channel.setSound(null, null)
      manager.createNotificationChannel(channel)
    }

    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return false
    intent.putExtra(EXTRA_FEED, true)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val pendingIntent = PendingIntent.getActivity(context, id, intent, flags)

    val smallIcon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon
    val notification = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()
    manager.notify(id, notification)
    return true
  }

  /** Whether the intent came from a feed notification tap; clears the mark so it fires once. */
  fun takeFeedTap(intent: Intent?): Boolean {
    if (intent?.getBooleanExtra(EXTRA_FEED, false) != true) return false
    intent.removeExtra(EXTRA_FEED)
    return true
  }
}
