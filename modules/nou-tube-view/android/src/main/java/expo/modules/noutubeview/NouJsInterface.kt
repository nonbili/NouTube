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

  // The setters below reach past the page: brightness owns the activity window
  // and volume owns the system media stream. Every frame in the WebView sees
  // this interface, so they are gated on the token that only the main frame
  // gets (see NouTubeView.bridgeToken).
  //
  // 0..1 dims/brightens the fullscreen player only; -1 hands control back to
  // the system brightness setting.
  @JavascriptInterface
  fun setBrightness(token: String?, value: Float) {
    if (!view.isBridgeTokenValid(token)) {
      return
    }
    view.setBrightness(value)
  }

  // -1 when the current brightness cannot be read.
  @JavascriptInterface
  fun getBrightness(token: String?): Float = if (view.isBridgeTokenValid(token)) view.getBrightness() else -1f

  // Whether the background playback guard may resume a pause it did not cause:
  // false during calls or while another app holds the music stream, so the
  // guard never fights a real audio interruption (content/background-guard.ts).
  @JavascriptInterface
  fun canAutoResume(token: String?): Boolean =
    if (view.isBridgeTokenValid(token)) view.canAutoResume() else false

  // The media stream is stepped, not continuous, so the panel drives it by
  // index instead of by percent.
  @JavascriptInterface
  fun getVolumeSteps(token: String?): Int = if (view.isBridgeTokenValid(token)) view.getVolumeSteps() else 0

  @JavascriptInterface
  fun getVolumeIndex(token: String?): Int = if (view.isBridgeTokenValid(token)) view.getVolumeIndex() else 0

  @JavascriptInterface
  fun setVolumeIndex(token: String?, index: Int) {
    if (!view.isBridgeTokenValid(token)) {
      return
    }
    view.setVolumeIndex(index)
  }

  // Completes an awaited eval (see NouTubeView.evalAwait). Token-gated like the setters above:
  // without it any frame could answer — or hijack — a pending eval.
  @JavascriptInterface
  fun resolveEval(token: String?, id: String, value: String?, error: String?) {
    if (!view.isBridgeTokenValid(token)) {
      return
    }
    view.resolveEval(id, value, error)
  }
}
