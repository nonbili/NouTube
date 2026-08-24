package expo.modules.noutubeview

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.media.AudioManager
import android.provider.Settings
import android.util.AttributeSet
import android.view.ContextMenu
import android.view.Menu
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.OrientationEventListener
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.ByteArrayInputStream
import java.net.URI
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

val BLOCK_HOSTS = arrayOf(
  "www.googletagmanager.com",
  "googleads.g.doubleclick.net"
)

val VIEW_HOSTS = arrayOf(
  "youtube.com",
  "youtu.be"
)

internal fun fullscreenOrientationFor(isPortrait: Boolean): Int =
  if (isPortrait) ActivityInfo.SCREEN_ORIENTATION_USER
  else ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

private val YOUTUBE_VIDEO_ID = Regex("^[A-Za-z0-9_-]{6,20}$")
private val YOUTUBE_VIDEO_PATH = Regex("^/(?:shorts|embed|live|v)/([A-Za-z0-9_-]{6,20})(?:/.*)?$")

internal fun isYouTubeVideoUrl(value: String): Boolean {
  return try {
    val url = URI(value)
    val host = url.host?.lowercase() ?: return false
    val path = url.path ?: ""
    if (host == "youtu.be" || host.endsWith(".youtu.be")) {
      return YOUTUBE_VIDEO_ID.matches(path.removePrefix("/"))
    }
    if (host != "youtube.com" && !host.endsWith(".youtube.com")) {
      return false
    }
    if (YOUTUBE_VIDEO_PATH.matches(path)) {
      return true
    }
    path == "/watch" && url.rawQuery.orEmpty().split('&').any { parameter ->
      parameter.substringBefore('=') == "v" && YOUTUBE_VIDEO_ID.matches(parameter.substringAfter('=', ""))
    }
  } catch (_: Exception) {
    false
  }
}

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

    // The default policy waives the renderer priority when the WebView is not
    // visible, leaving the renderer at cached importance in the background
    // where the system may kill it for using CPU while playing audio (#309).
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      setRendererPriorityPolicy(RENDERER_PRIORITY_IMPORTANT, false)
    }

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
  private var userScriptsOnStart: List<String> = emptyList()

  // addJavascriptInterface hands NouTubeI to every frame, ad iframes included,
  // and gives no way to tell them apart. This token is only ever evaluated into
  // the main frame (see onPageStarted), so cross-origin frames cannot read it
  // and the device-level setters below stay out of their reach.
  private val bridgeToken = UUID.randomUUID().toString()

  internal fun isBridgeTokenValid(token: String?) = token == bridgeToken

  private val pendingEvals = ConcurrentHashMap<String, CancellableContinuation<String?>>()

  // Called back from the page (NouJsInterface.resolveEval) once an awaited expression settles.
  internal fun resolveEval(id: String, value: String?, error: String?) {
    val cont = pendingEvals.remove(id) ?: return
    if (error != null) {
      cont.resumeWithException(Exception(error))
    } else {
      cont.resume(value, null)
    }
  }

  // evaluateJavascript hands back the JSON of whatever the expression evaluated to at once, and
  // a promise serializes to {} — so an async expression gets a callback of its own instead and
  // the coroutine waits for the page to call back through the bridge. `script` has to be an
  // expression; the result is JSON, matching NouWebView.eval.
  suspend fun evalAwait(script: String): String? {
    val id = UUID.randomUUID().toString()
    val result = withTimeoutOrNull(EVAL_TIMEOUT_MS) {
      suspendCancellableCoroutine { cont: CancellableContinuation<String?> ->
        pendingEvals[id] = cont
        cont.invokeOnCancellation { pendingEvals.remove(id) }
        // The token travels in the evaluated script, which only ever reaches the main frame, so
        // a cross-origin frame cannot answer a pending eval of ours.
        val wrapped = """
          (function () {
            var settle = function (value, error) {
              window.NouTubeI.resolveEval(
                "$bridgeToken",
                "$id",
                value === undefined || value === null ? null : JSON.stringify(value),
                error
              )
            }
            try {
              Promise.resolve((function () { return ($script) })()).then(
                function (value) { settle(value, null) },
                function (error) { settle(null, String((error && error.message) || error)) }
              )
            } catch (error) {
              settle(null, String((error && error.message) || error))
            }
          })()
        """.trimIndent()
        webView.post { webView.evaluateJavascript(wrapped, null) }
      }
    }
    return result?.removeSurrounding("\"")
  }
  private var isWindowInBackground = false
  private var pageUrl = ""
  private var customView: View? = null
  private var pullToRefreshEnabled = true
  private var cutoutLeft = 0
  private var cutoutRight = 0
  private lateinit var orientationListener: NouOrientationListener
  private val swipeRefreshLayout = SwipeRefreshLayout(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    isEnabled = true
    setOnRefreshListener {
      webView.reload()
    }
  }

  private val gestureListener =
    object : GestureDetector.SimpleOnGestureListener() {
      override fun onScroll(e1: MotionEvent?, e2: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
        var dy = distanceY
        if (e1 != null) {
          dy = (e2.y - e1.y) / context.resources.displayMetrics.density
        }
        emit("scroll", mapOf("dy" to dy, "y" to webView.scrollY))
        return false
      }
    }

  private val gestureDetector = GestureDetector(context, gestureListener)

  private var service: NouService? = null
  private var serviceConnection: ServiceConnection? = null

  companion object {
    private const val LINK_LOADING_GROUP_ID = 0x4e4f55
    private const val REQUEST_POST_NOTIFICATIONS = 102

    // A page that never settles its promise would otherwise keep the continuation — and the
    // caller — waiting forever.
    private const val EVAL_TIMEOUT_MS = 15_000L

    // The service is a singleton and the view has no destroy hook, so the
    // live binding is tracked per process: a remount replaces it instead of
    // stacking one more connection onto the service. It is bound through the
    // application context, so unbinding still works after the activity that
    // set it up has been recreated.
    private var activeServiceConnection: ServiceConnection? = null

    // requestPermissions is fire-and-forget from a view (there is no result
    // callback to observe here), so ask at most once per process: a remount
    // must not re-raise the system dialog after the user denied it.
    private var notificationPermissionRequested = false
  }

  internal val currentActivity: Activity?
    get() = appContext.activityProvider?.currentActivity

  fun setTextZoom(zoom: Int) {
    webView.settings.textZoom = zoom
  }

  private fun emitLinkAction(type: String, url: String, title: String? = null) {
    if (title != null) {
      emit(type, mapOf("title" to title, "url" to url))
      return
    }

    val message = Message.obtain(
      Handler(Looper.getMainLooper()) { result ->
        emit(
          type,
          mapOf(
            "title" to result.data?.getString("title").orEmpty(),
            "url" to url,
          ),
        )
        true
      },
    )
    webView.requestFocusNodeHref(message)
  }

  private fun addLinkContextMenuItems(menu: ContextMenu, activity: Activity, url: String, title: String? = null) {
    if (isYouTubeVideoUrl(url)) {
      menu.add("Download").setOnMenuItemClickListener {
        emit("download", mapOf("url" to url))
        true
      }
      menu.add("Star").setOnMenuItemClickListener {
        emitLinkAction("star", url, title)
        true
      }
      menu.add("Add to queue").setOnMenuItemClickListener {
        emitLinkAction("add-queue", url, title)
        true
      }
    }

    menu.add("Copy link").setOnMenuItemClickListener {
      val clipboardManager = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clipData = ClipData.newPlainText("link", url)
      clipboardManager.setPrimaryClip(clipData)
      true
    }
  }

  override fun onCreateContextMenu(menu: ContextMenu) {
    super.onCreateContextMenu(menu)

    val result = webView.getHitTestResult()
    val activity = currentActivity ?: return

    if (result.getType() == WebView.HitTestResult.SRC_ANCHOR_TYPE) {
      result.getExtra()?.let { addLinkContextMenuItems(menu, activity, it) }
    } else if (result.getType() == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) {
      // https://stackoverflow.com/a/77852272
      menu.add(LINK_LOADING_GROUP_ID, Menu.NONE, Menu.NONE, "Loading link…").isEnabled = false
      val message = Message.obtain(
        Handler(Looper.getMainLooper()) { href ->
          menu.removeGroup(LINK_LOADING_GROUP_ID)
          href.data?.getString("url")?.let { url ->
            addLinkContextMenuItems(menu, activity, url, href.data?.getString("title"))
          }
          true
        },
      )
      webView.requestFocusNodeHref(message)
    }
  }

  internal val webView: NouWebView =
    NouWebView(context).apply {
      layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
      setOnTouchListener { _, event ->
        gestureDetector.onTouchEvent(event)
        false
      }
      webViewClient =        object : WebViewClient() {
          override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
            if (pageUrl != url) {
              pageUrl = url
              updateSwipeRefreshEnabled()
              onLoad(
                mapOf(
                  "url" to pageUrl
                )
              )
            }
          }

          override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            // NouTubeBackground must survive navigations (the queue advances in
            // the background), so seed every new document with the current value.
            evaluateJavascript(
              "window.NouTubeToken = '$bridgeToken';window.NouTubeBackground = $isWindowInBackground;$scriptOnStart",
              null
            )
            // Each user script is its own compilation unit: a syntax error in
            // one must not take the others, or the content bundle, down with it.
            userScriptsOnStart.forEach { evaluateJavascript(it, null) }
          }

          override fun onPageFinished(view: WebView, url: String) {
            swipeRefreshLayout.isRefreshing = false
            // insets are usually dispatched once, long before this document exists
            applyCutoutInsets()
          }

          override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (request.url.host in BLOCK_HOSTS) {
              return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
            }
            return null
          }

          override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
            val uri = Uri.parse(url)
            if (uri.scheme == "vnd.youtube.music") {
              emit("yt-music-desktop", mapOf<String, Any>())
              return true
            }
            if (uri.host in VIEW_HOSTS ||
              (uri.host?.startsWith("accounts.google.") == true) ||
              (uri.host?.startsWith("gds.google.") == true) ||
              (uri.host?.endsWith(".youtube.com") == true)
            ) {
              return false
            } else {
              try {
                view.getContext().startActivity(
                  Intent(Intent.ACTION_VIEW, uri)
                )
              } catch (e: ActivityNotFoundException) {
                Toast.makeText(
                  view.getContext(),
                  "No app found to open this link",
                  Toast.LENGTH_SHORT
                ).show()
              }
              return true
            }
          }
        }

      webChromeClient = object : WebChromeClient() {
        override fun getDefaultVideoPoster(): Bitmap {
          return Bitmap.createBitmap(intArrayOf(Color.BLACK), 1, 1, Bitmap.Config.ARGB_8888)
        }

        override fun onPermissionRequest(request: PermissionRequest) {
          val activity = currentActivity
          if (activity == null) {
            request.deny()
            return
          }

          val resources = request.resources
          val permissionsToRequest = mutableListOf<String>()

          if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            permissionsToRequest.add(android.Manifest.permission.RECORD_AUDIO)
          }
          if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            permissionsToRequest.add(android.Manifest.permission.CAMERA)
          }

          if (permissionsToRequest.isEmpty()) {
            request.grant(resources)
            return
          }

          activity.requestPermissions(permissionsToRequest.toTypedArray(), 101)
          request.grant(resources)
        }

        override fun onJsBeforeUnload(view: WebView, url: String, message: String, result: JsResult): Boolean {
          result.confirm()
          return true
        }

        override fun onShowCustomView(view: View, cllback: CustomViewCallback) {
          customView = view
          view.setKeepScreenOn(true)
          val activity = currentActivity
          if (activity == null) {
            return
          }
          val window = activity.window
          (window.decorView as FrameLayout).addView(
            view,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
          )
          webView.evaluateJavascript(
            "(() => { const video = document.querySelector('#movie_player video') || " +
              "document.querySelector('video'); return !!video && video.videoHeight > video.videoWidth })()"
          ) { isPortrait ->
            if (customView !== view) {
              return@evaluateJavascript
            }
            activity.setRequestedOrientation(
              // Do not force portrait videos back to portrait when the user rotates the device.
              // That conflicts with the web player's orientation-driven fullscreen handling and
              // causes it to repeatedly enter and exit fullscreen.
              fullscreenOrientationFor(isPortrait == "true")
            )

            if (isPortrait != "true" &&
              Settings.System.getInt(activity.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0) == 1
            ) {
              orientationListener.enable()
            }
          }

          // https://stackoverflow.com/a/64828067
          val controller = WindowCompat.getInsetsController(window, window.decorView)
          controller.hide(WindowInsetsCompat.Type.systemBars())
          controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        }

        override fun onHideCustomView() {
          val activity = currentActivity
          if (activity == null) {
            return
          }
          val window = activity.window
          (window.decorView as FrameLayout).removeView(customView)
          // The brightness override belongs to the fullscreen player only.
          window.attributes = window.attributes.apply {
            screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
          }
          customView?.setKeepScreenOn(false)
          customView = null
          activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER)

          val controller = WindowCompat.getInsetsController(window, window.decorView)
          controller.show(WindowInsetsCompat.Type.systemBars())
          controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT

          // removing the fullscreen view clears InputMethodManager's served view;
          // requestFocus alone is a no-op (the WebView never lost view focus), so
          // force a focus transition or the keyboard never shows again
          this@apply.clearFocus()
          this@apply.requestFocus()
          orientationListener.disable()
        }
      }
    }

  init {
    swipeRefreshLayout.addView(webView)
    addView(swipeRefreshLayout)

    initService()

    val activity = currentActivity
    activity?.registerForContextMenu(webView)

    webView.addJavascriptInterface(NouJsInterface(context, this), "NouTubeI")

    // some websites have `padding-bottom: env(safe-area-inset-bottom)`, this set it to 0
    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
      val cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
      val density = resources.displayMetrics.density
      val left = (cutout.left / density).toInt()
      val right = (cutout.right / density).toInt()
      if (left != cutoutLeft || right != cutoutRight) {
        cutoutLeft = left
        cutoutRight = right
        applyCutoutInsets()
      }
      WindowInsetsCompat.CONSUMED
    }
  }

  // NouWebView fakes its own window visibility so the page never pauses, which
  // also blinds the page to being backgrounded. This container sees the real
  // value; hand it to the page so the background playback guard only fights
  // YouTube's background pauses, never a user's own pause (see
  // content/background-guard.ts).
  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    // The dispatched value is not the window state alone: ViewGroup also feeds
    // this from dispatchAttachedToWindow with combineVisibility(window,
    // ancestor visibility), so attaching under a GONE ancestor (an inactive
    // react-native-screens screen) would look exactly like backgrounding, and
    // the guard would then resume playback the user paused on purpose.
    // windowVisibility is the raw window state.
    val inBackground = windowVisibility != View.VISIBLE
    if (inBackground == isWindowInBackground) {
      return
    }
    isWindowInBackground = inBackground
    webView.evaluateJavascript("window.NouTubeBackground = $isWindowInBackground", null)
  }

  // Consuming the insets above also zeroes env(safe-area-inset-*) in the page,
  // but fullscreen overlays still have to dodge the display cutout: fullscreen
  // draws under it (targetSdk 35+ defaults to LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS)
  // and in landscape the camera lands on a side edge, right where the lock
  // button sits. Publish it as a CSS variable instead.
  private fun applyCutoutInsets() {
    webView.evaluateJavascript(
      "document.documentElement && (" +
        "document.documentElement.style.setProperty('--_nou_cutout_left', '${cutoutLeft}px')," +
        "document.documentElement.style.setProperty('--_nou_cutout_right', '${cutoutRight}px'))",
      null
    )
  }

  fun setPullToRefreshEnabled(enabled: Boolean) {
    pullToRefreshEnabled = enabled
    updateSwipeRefreshEnabled()
  }

  private fun updateSwipeRefreshEnabled() {
    // accidental pulls are too easy while scrubbing the player on /watch and /shorts
    val path = Uri.parse(pageUrl).path ?: ""
    val enabled = pullToRefreshEnabled && !path.startsWith("/watch") && !path.startsWith("/shorts")
    swipeRefreshLayout.isEnabled = enabled
    if (!enabled) {
      swipeRefreshLayout.isRefreshing = false
    }
  }

  fun initService() {
    val activity = currentActivity
    if (activity == null) {
      return
    }

    // The media notification is invisible without this on Android 13+, and the
    // app never surfaces in the system media controls ("not a music app", #309).
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU &&
      !notificationPermissionRequested &&
      activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
      android.content.pm.PackageManager.PERMISSION_GRANTED
    ) {
      notificationPermissionRequested = true
      activity.requestPermissions(
        arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
        REQUEST_POST_NOTIFICATIONS
      )
    }

    // A remount runs this again; drop the previous binding instead of stacking
    // one more onto the service.
    val bindContext = activity.applicationContext
    activeServiceConnection?.let { previous ->
      activeServiceConnection = null
      try {
        bindContext.unbindService(previous)
      } catch (e: IllegalArgumentException) {
        // Not bound anymore.
      }
    }

    val connection = object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName, binder: IBinder) {
        val nouBinder = binder as NouService.NouBinder
        service = nouBinder.getService()
        service?.initialize(webView, activity)
        nouController.service = service
        nouController.applyPendingSleepTimer()
      }

      override fun onServiceDisconnected(name: ComponentName) {
      }
    }
    val intent = Intent(activity, NouService::class.java)
    // Start the service in addition to binding it. A bound-only service loses
    // its foreground state more easily; a started one keeps it until exit(),
    // and if the system stops the service anyway, the binding recreates it and
    // ensureForeground re-promotes it on the next playing progress tick.
    try {
      activity.startService(intent)
    } catch (e: Exception) {
      // Background start restrictions: binding below still works.
    }
    bindContext.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    serviceConnection = connection
    activeServiceConnection = connection

    orientationListener = NouOrientationListener(activity, this)
  }

  fun setScriptOnStart(script: String) {
    scriptOnStart = script
  }

  fun setUserScriptsOnStart(scripts: List<String>) {
    userScriptsOnStart = scripts
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
    currentActivity?.runOnUiThread {
      webView.keepScreenOn = playing
      customView?.keepScreenOn = playing
    }
  }

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  // A pause is only auto-resumable when it cannot be an audio interruption:
  // no ongoing call/ring/VoIP and no other app playing on the music stream.
  fun canAutoResume(): Boolean =
    try {
      audioManager.mode == AudioManager.MODE_NORMAL && !audioManager.isMusicActive
    } catch (e: Exception) {
      false
    }

  fun getVolumeSteps(): Int =
    try {
      audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    } catch (e: Exception) {
      0
    }

  fun getVolumeIndex(): Int =
    try {
      audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
    } catch (e: Exception) {
      0
    }

  fun setVolumeIndex(index: Int) {
    try {
      val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, index.coerceIn(0, max), 0)
    } catch (e: Exception) {
      // Do Not Disturb can reject volume changes; nothing to recover here.
    }
  }

  // The window override once set, otherwise the system brightness the window is
  // currently inheriting.
  fun getBrightness(): Float {
    val override = currentActivity?.window?.attributes?.screenBrightness ?: -1f
    if (override >= 0) {
      return override
    }
    return try {
      Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS) / 255f
    } catch (e: Exception) {
      -1f
    }
  }

  fun setBrightness(value: Float) {
    val clamped = if (value < 0) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE else value.coerceIn(0.01f, 1f)
    currentActivity?.runOnUiThread {
      val window = currentActivity?.window ?: return@runOnUiThread
      window.attributes = window.attributes.apply { screenBrightness = clamped }
    }
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

  // Bound through the application context, so nothing releases the binding on
  // its own: without this the service — and the activity and WebView it holds
  // — outlives the view, even after exit() called stopSelf(). Driven by
  // OnViewDestroys in NouTubeViewModule.
  fun destroyService() {
    val connection = serviceConnection ?: return
    serviceConnection = null
    // A newer view may already own the live binding; only ever drop our own.
    if (activeServiceConnection === connection) {
      activeServiceConnection = null
    }
    try {
      context.applicationContext.unbindService(connection)
    } catch (e: IllegalArgumentException) {
      // Not bound anymore.
    }
    service = null
  }
}
