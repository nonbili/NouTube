package expo.modules.noutubeview

import android.content.Context
import android.webkit.JavascriptInterface

class NouJsInterface(private val mContext: Context) {
  @JavascriptInterface
  fun onMessage(payload: String) {
    nouController.onMessage(payload)
  }

  @JavascriptInterface
  fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
    nouController.notify(title, author, seconds, thumbnail)
  }

  @JavascriptInterface
  fun notifyProgress(playing: Boolean, pos: Long) {
    nouController.notifyProgress(playing, pos)
  }
}
