package expo.modules.noutubeview

import android.content.Context
import android.webkit.JavascriptInterface

class NouJsInterface(private val context: Context, private val view: NouTubeView) {
  @JavascriptInterface
  fun onMessage(payload: String) {
    view.onMessage(mapOf("payload" to payload))
  }

  @JavascriptInterface
  fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
    view.notify(title, author, seconds, thumbnail)
  }

  @JavascriptInterface
  fun notifyProgress(playing: Boolean, pos: Long) {
    view.notifyProgress(playing, pos)
  }
}
