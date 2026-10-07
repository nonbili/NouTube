package expo.modules.noutubeview

import android.annotation.SuppressLint
import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONTokener

private const val LOGIN_URL = "https://discord.com/login"
private const val DISCORD_ORIGIN = "https://discord.com"
private const val POLL_INTERVAL_MS = 1000L

// Discord removes window.localStorage from its own pages; a fresh iframe still has it.
private const val READ_TOKEN_JS = """(function() {
  try {
    var frame = document.createElement('iframe');
    document.body.appendChild(frame);
    var raw = frame.contentWindow.localStorage.getItem('token');
    frame.remove();
    return raw ? JSON.parse(raw) : '';
  } catch (e) {
    return '';
  }
})()"""

/** Discord's own login page; closes itself once the account token can be read. */
class DiscordLoginActivity : Activity() {
  private lateinit var webView: WebView
  private val handler = Handler(Looper.getMainLooper())
  private var done = false

  // The token is written a moment after Discord navigates to the app, and that
  // navigation does not always reach the WebViewClient, so keep looking.
  private val poll = object : Runnable {
    override fun run() {
      readToken()
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    webView = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      webViewClient = WebViewClient()
    }
    val root = FrameLayout(this)
    root.addView(webView, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    // Activities are edge-to-edge from Android 15 on; keep the form clear of
    // the system bars and the keyboard.
    ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      WindowInsetsCompat.CONSUMED
    }
    setContentView(root)
    webView.loadUrl(LOGIN_URL)
    handler.postDelayed(poll, POLL_INTERVAL_MS)
  }

  private fun readToken() {
    if (done) return
    val path = Uri.parse(webView.url ?: return).path ?: return
    // Discord lands here once the login went through.
    if (!path.startsWith("/app") && !path.startsWith("/channels")) return
    webView.evaluateJavascript(READ_TOKEN_JS) { raw ->
      val token = try {
        JSONTokener(raw ?: "").nextValue() as? String
      } catch (e: Exception) {
        null
      }
      if (!token.isNullOrEmpty() && !done) {
        done = true
        NouDiscord.saveToken(token)
        finish()
      }
    }
  }

  // Only the token is kept; the web session would otherwise sit in the storage
  // and the cookie jar this WebView shares with the YouTube one. It runs once
  // the page is gone, so nothing is left to write the session back.
  private fun clearWebSession() {
    WebStorage.getInstance().deleteOrigin(DISCORD_ORIGIN)
    val cookies = CookieManager.getInstance()
    val names = (cookies.getCookie(DISCORD_ORIGIN) ?: "").split(";").map { it.substringBefore("=").trim() }
    for (name in names.filter { it.isNotEmpty() }) {
      // A cookie only goes away when the domain it was set for is named, and
      // a __Secure- one only accepts a write that is Secure itself.
      cookies.setCookie(DISCORD_ORIGIN, "$name=; Max-Age=0; Path=/; Secure")
      cookies.setCookie(DISCORD_ORIGIN, "$name=; Max-Age=0; Path=/; Secure; Domain=.discord.com")
    }
    cookies.flush()
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (webView.canGoBack()) {
      webView.goBack()
    } else {
      @Suppress("DEPRECATION")
      super.onBackPressed()
    }
  }

  override fun onDestroy() {
    handler.removeCallbacks(poll)
    (webView.parent as? ViewGroup)?.removeView(webView)
    webView.destroy()
    clearWebSession()
    val finished = NouDiscord.onLoginFinished
    NouDiscord.onLoginFinished = null
    finished?.invoke()
    super.onDestroy()
  }
}
