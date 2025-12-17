package expo.modules.noutubeview

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.Uri
import android.os.IBinder
import android.provider.Settings
import android.util.AttributeSet
import android.view.ContextMenu
import android.view.MenuItem
import android.view.OrientationEventListener
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.ByteArrayInputStream
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

val BLOCK_HOSTS = arrayOf(
  "www.googletagmanager.com",
  "googleads.g.doubleclick.net"
)

val VIEW_HOSTS = arrayOf(
  "youtube.com",
  "youtu.be"
)

class NouWebView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0) :
  WebView(context, attrs, defStyleAttr) {

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(VISIBLE)
  }

  init {
    settings.run {
      javaScriptEnabled = true
      domStorageEnabled = true
      mediaPlaybackRequiresUserGesture = false
      supportZoom()
      builtInZoomControls = true
      displayZoomControls = false
    }
    CookieManager.getInstance().setAcceptCookie(true)

    // https://stackoverflow.com/a/64564676
    setFocusable(true)
    setFocusableInTouchMode(true)
  }

  suspend fun eval(script: String): String? = suspendCancellableCoroutine { cont ->
    evaluateJavascript(script) { result ->
      if (result == "null") {
        cont.resume(null, null)
      } else {
        cont.resume(result.removeSurrounding("\""), null)
      }
    }
  }
}

class NouOrientationListener(context: Context, private val view: NouTubeView) : OrientationEventListener(context) {
  override fun onOrientationChanged(orientation: Int) {
    view.onOrientationChanged(orientation)
  }
}

class NouTubeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onLoad by EventDispatcher()
  internal val onMessage by EventDispatcher()

  private var scriptOnStart = ""
  private var pageUrl = ""
  private var customView: View? = null
  private lateinit var orientationListener: NouOrientationListener

  private var service: NouService? = null

  internal val currentActivity: Activity?
    get() = appContext.activityProvider?.currentActivity

  override fun onCreateContextMenu(menu: ContextMenu) {
    super.onCreateContextMenu(menu)

    val result = webView.getHitTestResult()
    val activity = currentActivity
    var url: String? = null

    if (result.getType() == WebView.HitTestResult.SRC_ANCHOR_TYPE) {
      url = result.getExtra()
    } else if (result.getType() == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) {
      // https://stackoverflow.com/a/77852272
      val href = webView.getHandler().obtainMessage()
      webView.requestFocusNodeHref(href)
      val data = href.getData()
      if (data != null) {
        url = data.getString("url")
      }
    }
    if (
      url != null && activity != null
    ) {
      val onCopyLink = object : MenuItem.OnMenuItemClickListener {
        override fun onMenuItemClick(item: MenuItem): Boolean {
          val clipboardManager = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
          val clipData = ClipData.newPlainText("link", url)
          clipboardManager.setPrimaryClip(clipData)
          return true
        }
      }

      menu.add("Copy link").setOnMenuItemClickListener(onCopyLink)
    }
  }
  internal val webView =
    NouWebView(context).apply {
      layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
      webViewClient =
        object : WebViewClient() {
          override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
            if (pageUrl != url) {
              pageUrl = url
              onLoad(
                mapOf(
                  "url" to pageUrl
                )
              )
            }
          }

          override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            evaluateJavascript(scriptOnStart, null)
          }

          override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (request.url.host in BLOCK_HOSTS) {
              return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
            }
            return null
          }

          override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
            val uri = Uri.parse(url)
            if (uri.host in VIEW_HOSTS ||
              (uri.host?.startsWith("accounts.google.") == true) ||
              (uri.host?.startsWith("gds.google.") == true) ||
              (uri.host?.endsWith(".youtube.com") == true)
            ) {
              return false
            } else {
              view.getContext().startActivity(
                Intent(Intent.ACTION_VIEW, uri)
              )
              return true
            }
          }
        }

      webChromeClient = object : WebChromeClient() {
        override fun onJsBeforeUnload(view: WebView, url: String, message: String, result: JsResult): Boolean {
          result.confirm()
          return true
        }

        override fun onShowCustomView(view: View, cllback: CustomViewCallback) {
          customView = view
          val activity = currentActivity
          if (activity == null) {
            return
          }
          val window = activity.window
          (window.decorView as FrameLayout).addView(
            view,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
          )
          activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE)

          // https://stackoverflow.com/a/64828067
          val controller = WindowCompat.getInsetsController(window, window.decorView)
          controller.hide(WindowInsetsCompat.Type.systemBars())
          controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

          if (Settings.System.getInt(activity.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0) == 1) {
            orientationListener.enable()
          }
        }

        override fun onHideCustomView() {
          val activity = currentActivity
          if (activity == null) {
            return
          }
          val window = activity.window
          (window.decorView as FrameLayout).removeView(customView)
          activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER)

          val controller = WindowCompat.getInsetsController(window, window.decorView)
          controller.show(WindowInsetsCompat.Type.systemBars())

          orientationListener.disable()
        }
      }
    }

  init {
    addView(webView)

    initService()

    val activity = currentActivity
    activity?.registerForContextMenu(webView)

    webView.addJavascriptInterface(NouJsInterface(context, this), "NouTubeI")
  }

  fun initService() {
    val activity = currentActivity
    if (activity == null) {
      return
    }
    val connection = object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName, binder: IBinder) {
        val nouBinder = binder as NouService.NouBinder
        service = nouBinder.getService()
        service?.initialize(webView, activity)
        nouController.service = service
      }

      override fun onServiceDisconnected(name: ComponentName) {
      }
    }
    val intent = Intent(activity, NouService::class.java)
    activity.bindService(intent, connection, Context.BIND_AUTO_CREATE)

    orientationListener = NouOrientationListener(activity, this)
  }

  fun setScriptOnStart(script: String) {
    scriptOnStart = script
  }

  fun clearData() {
    val cookieManager = CookieManager.getInstance()
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
      cookieManager.removeAllCookies(null)
    } else {
      cookieManager.removeAllCookie()
    }
    cookieManager.flush()

    webView.clearCache(true)
    webView.clearHistory()
    webView.clearFormData()
    webView.reload()
  }

  fun emit(type: String, data: Any) {
    val payload = mapOf("type" to type, "data" to data)
    onMessage(mapOf("payload" to payload))
  }

  fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
    service?.notify(title, author, seconds, thumbnail)
  }

  fun notifyProgress(playing: Boolean, pos: Long) {
    service?.notifyProgress(playing, pos)
  }

  fun onOrientationChanged(orientation: Int) {
    val activity = currentActivity
    if (activity?.getRequestedOrientation() == ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE &&
      (orientation in 70..110 || orientation in 250..290)
    ) {
      activity?.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER)
    }
  }

  fun exit() {
    service?.exit()
  }
}
