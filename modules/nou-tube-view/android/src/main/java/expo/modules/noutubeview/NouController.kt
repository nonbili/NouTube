package expo.modules.noutubeview

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ActivityInfo
import android.os.IBinder
import android.provider.Settings
import android.view.OrientationEventListener
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class NouOrientationListener(context: Context) : OrientationEventListener(context) {
  override fun onOrientationChanged(orientation: Int) {
    nouController.onOrientationChanged(orientation)
  }
}

class NouController {
  private var activity: Activity? = null
  private var nouTubeView: NouTubeView? = null
  private var service: NouService? = null
  private var orientationListener: NouOrientationListener? = null
  internal var inited = false

  fun setActivity(v: Activity) {
    activity = v
    orientationListener = NouOrientationListener(v)
  }

  fun setNouTubeView(v: NouTubeView) {
    nouTubeView = v
  }

  fun initService() {
    if (nouTubeView != null && activity != null) {
      val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
          val nouBinder = binder as NouService.NouBinder
          service = nouBinder.getService()
          service?.initialize(nouTubeView!!.webView, activity!!)
        }

        override fun onServiceDisconnected(name: ComponentName) {
        }
      }
      val intent = Intent(activity, NouService::class.java)
      activity!!.bindService(intent, connection, Context.BIND_AUTO_CREATE)

      inited = true
    }
  }

  fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
    service?.notify(title, author, seconds, thumbnail)
  }

  fun notifyProgress(playing: Boolean, pos: Long) {
    service?.notifyProgress(playing, pos)
  }

  fun goBack() {
    val webView = nouTubeView!!.webView
    if (webView.canGoBack()) {
      webView.goBack()
    } else {
      activity?.finish()
    }
  }

  fun onMessage(payload: String) {
    nouTubeView?.onMessage(mapOf("payload" to payload))
  }

  fun showFullscreen(view: View) {
    val window = activity!!.window
    (window.decorView as FrameLayout).addView(
      view,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    )
    activity!!.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE)

    // https://stackoverflow.com/a/64828067
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.hide(WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    if (Settings.System.getInt(activity!!.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0) == 1) {
      orientationListener?.enable()
    }
  }

  fun exitFullscreen(view: View) {
    val window = activity!!.window
    (window.decorView as FrameLayout).removeView(view)
    activity!!.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER)

    WindowCompat.setDecorFitsSystemWindows(window, true)
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.show(WindowInsetsCompat.Type.systemBars())

    orientationListener?.disable()
  }

  fun onOrientationChanged(orientation: Int) {
    if (activity?.getRequestedOrientation() != ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE) {
      return
    }
    if (orientation in 70..110 || orientation in 250..290) {
      activity!!.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER)
    }
  }
}

val nouController = NouController()
