package expo.modules.noutubeview

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder

class NouController {
  private var activity: Activity? = null
  private var nouTubeView: NouTubeView? = null
  private var service: NouService? = null

  fun setActivity(v: Activity) {
    activity = v
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
}

val nouController = NouController()
