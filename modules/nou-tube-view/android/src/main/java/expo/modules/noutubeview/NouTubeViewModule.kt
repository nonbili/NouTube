package expo.modules.noutubeview

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.accessibility.CaptioningManager
import androidx.appcompat.app.AppCompatDelegate
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.jni.JavaScriptObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.zip.ZipInputStream

class NouTubeViewModule : Module() {
  private var lastProxyKey: String? = null

  private fun ytDlp(): NouYtDlp {
    val context = appContext.reactContext?.applicationContext ?: throw Exception("Application context is unavailable")
    return NouYtDlp(context)
  }

  private fun applyProxy(settings: NouSettings) {
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) {
      nouController.log("proxy override is not supported")
      return
    }

    val proxyKey = "${settings.proxyEnabled}|${settings.proxyType}|${settings.proxyHost}|${settings.proxyPort}"
    if (proxyKey == lastProxyKey) {
      return
    }
    lastProxyKey = proxyKey

    val executor = java.util.concurrent.Executor { command -> command.run() }
    if (settings.proxyEnabled && settings.proxyHost.isNotBlank()) {
      val type = if (settings.proxyType == "socks") "socks" else "http"
      val portStr = if (settings.proxyPort.isNotBlank()) ":${settings.proxyPort}" else ""
      val proxyRule = "$type://${settings.proxyHost}$portStr"
      val proxyConfig = ProxyConfig.Builder()
        .addProxyRule(proxyRule)
        .build()
      try {
        ProxyController.getInstance().setProxyOverride(proxyConfig, executor, Runnable {
          nouController.log("proxy override applied: $proxyRule")
        })
      } catch (e: Exception) {
        nouController.log("setProxyOverride failed: ${e.message}")
      }
    } else {
      try {
        ProxyController.getInstance().clearProxyOverride(executor, Runnable {
          nouController.log("proxy override cleared")
        })
      } catch (e: Exception) {
        nouController.log("clearProxyOverride failed: ${e.message}")
      }
    }
  }

  private var captioningManager: CaptioningManager? = null
  private var captioningListener: CaptioningManager.CaptioningChangeListener? = null

  private fun captioning(): CaptioningManager? {
    captioningManager?.let { return it }
    val context = appContext.reactContext ?: return null
    val manager = context.getSystemService(Context.CAPTIONING_SERVICE) as? CaptioningManager
    captioningManager = manager
    return manager
  }

  /**
   * The system caption preferences. `userStyle` always returns a fully
   * populated style (white on black when untouched), so the has*() guards keep
   * unset fields null and let the web side fall back to YouTube's own styling.
   */
  private fun readCaptionStyle(): Map<String, Any?> {
    val manager = captioning() ?: return mapOf("enabled" to false, "fontScale" to 1.0f)
    val style = manager.userStyle
    return mapOf(
      "enabled" to manager.isEnabled,
      "fontScale" to manager.fontScale,
      "locale" to manager.locale?.toLanguageTag(),
      "foregroundColor" to style.foregroundColor.takeIf { style.hasForegroundColor() },
      "backgroundColor" to style.backgroundColor.takeIf { style.hasBackgroundColor() },
      "windowColor" to style.windowColor.takeIf { style.hasWindowColor() },
      "edgeType" to style.edgeType.takeIf { style.hasEdgeType() },
      "edgeColor" to style.edgeColor.takeIf { style.hasEdgeColor() },
    )
  }

  private fun emitCaptionStyle() {
    sendEvent("captionStyle", readCaptionStyle())
  }

  init {
    nouController.logFn = { msg: String ->
      sendEvent("log", mapOf("msg" to msg))
    }
    nouController.sleepTimerEventFn = { payload ->
      sendEvent("sleepTimer", payload)
    }
    nouController.desktopModeEventFn = { desktopMode ->
      sendEvent("desktopMode", mapOf("desktopMode" to desktopMode))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NouTubeView")

    Events("log", "sleepTimer", "downloadProgress", "captionStyle", "desktopMode")

    OnCreate {
      val manager = captioning() ?: return@OnCreate
      val listener = object : CaptioningManager.CaptioningChangeListener() {
        override fun onEnabledChanged(enabled: Boolean) = emitCaptionStyle()
        override fun onUserStyleChanged(userStyle: CaptioningManager.CaptionStyle) = emitCaptionStyle()
        override fun onFontScaleChanged(fontScale: Float) = emitCaptionStyle()
        override fun onLocaleChanged(locale: java.util.Locale?) = emitCaptionStyle()
      }
      manager.addCaptioningChangeListener(listener)
      captioningListener = listener
    }

    OnDestroy {
      captioningListener?.let { captioningManager?.removeCaptioningChangeListener(it) }
      captioningListener = null
      captioningManager = null
    }

    Function("getSystemCaptionStyle") {
      readCaptionStyle()
    }

    Function("isSystemDesktopMode") {
      isSystemDesktopMode(appContext.currentActivity ?: appContext.reactContext)
    }

    Function("setTheme") { theme: String? ->
      var mode = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
      if (theme == "dark") {
        mode = AppCompatDelegate.MODE_NIGHT_YES
      } else if (theme == "light") {
        mode = AppCompatDelegate.MODE_NIGHT_NO
      }
      AppCompatDelegate.setDefaultNightMode(mode)
    }

    Function("exit") {
      nouController.exit()
    }

    Function("setSettings") { settings: NouSettings ->
      NouProxy.update(settings)
      applyProxy(settings)
    }

    AsyncFunction("fetchFeed") Coroutine { url: String ->
      return@Coroutine fetchFeed(url)
    }

    Function("setLocaleStrings") { v: JavaScriptObject ->
      v.getPropertyNames().forEach {
        nouController.i18nStrings[it] = v[it]!!.getString()
      }
    }

    AsyncFunction("setSleepTimer") { durationMs: Long ->
      nouController.setSleepTimer(durationMs)
    }

    AsyncFunction("clearSleepTimer") {
      nouController.clearSleepTimer()
    }

    AsyncFunction("getSleepTimerRemainingMs") {
      nouController.getSleepTimerRemainingMs()
    }

    AsyncFunction("extractTakeoutCsvFiles") { uri: String ->
      extractTakeoutCsvFiles(uri)
    }

    AsyncFunction("listFormats") Coroutine { url: String, useCookies: Boolean ->
      return@Coroutine ytDlp().listFormats(url, useCookies)
    }

    AsyncFunction("downloadVideo") Coroutine { url: String, formatId: String, outputDir: String, useCookies: Boolean ->
      try {
        val result = ytDlp().downloadVideo(url, formatId, outputDir, useCookies) { progress, etaInSeconds, line ->
          sendEvent("downloadProgress", mapOf(
            "url" to url,
            "progress" to progress,
            "eta" to etaInSeconds,
            "line" to line,
            "done" to false,
            "error" to false
          ))
        }

        sendEvent("downloadProgress", mapOf(
          "url" to url,
          "progress" to 100f,
          "eta" to 0L,
          "line" to if (result.lastLine.isNotBlank()) result.lastLine else nouController.t("download_complete"),
          "done" to true,
          "error" to false,
          "filePath" to result.savedPath
        ))
      } catch (e: Exception) {
        sendEvent("downloadProgress", mapOf(
          "url" to url,
          "progress" to 0f,
          "eta" to 0L,
          "line" to (e.message ?: nouController.t("download_failed")),
          "done" to true,
          "error" to true
        ))
        throw e
      }
    }

    AsyncFunction("openFile") { path: String ->
      val context = appContext.reactContext ?: throw Exception("Application context is unavailable")
      val uri = if (path.startsWith("content://") || path.startsWith("file://")) {
        Uri.parse(path)
      } else {
        Uri.fromFile(File(path))
      }
      val mimeType = context.contentResolver.getType(uri) ?: "video/*"
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    AsyncFunction("getDownloadsPath") {
      android.os.Environment.DIRECTORY_DOWNLOADS
    }

    AsyncFunction("updateYtDlp") {
      ytDlp().update()
    }

    AsyncFunction("translateText") Coroutine { text: String, targetLanguage: String ->
      return@Coroutine NouTranslation.translateText(text, targetLanguage)
    }

    Function("getTranslationSupportedLanguages") {
      NouTranslation.getSupportedLanguages()
    }

    View(NouTubeView::class) {
      Prop("scriptOnStart") { view: NouTubeView, script: String ->
        view.setScriptOnStart(script)
      }

      Prop("useragent") { view: NouTubeView, ua: String ->
        view.webView.settings.setUserAgentString(ua)
      }

      Prop("pullToRefreshEnabled") { view: NouTubeView, enabled: Boolean ->
        view.setPullToRefreshEnabled(enabled)
      }

      Prop("textZoom") { view: NouTubeView, zoom: Int ->
        view.setTextZoom(zoom)
      }

      Events("onLoad", "onMessage")

      AsyncFunction("clearData") { view: NouTubeView -> view.clearData() }

      AsyncFunction("executeJavaScript") Coroutine
        { view: NouTubeView, script: String ->
          return@Coroutine view.webView.eval(script)
        }

      AsyncFunction("goBack") { view: NouTubeView ->
        val webView = view.webView
        if (webView.canGoBack()) {
          webView.goBack()
        } else {
          view.currentActivity?.finish()
        }
      }

      AsyncFunction("loadUrl") { view: NouTubeView, url: String ->
        view.webView.loadUrl(url)
      }
    }
  }

  private fun fetchFeed(url: String): Map<String, Any> {
    val parsed = java.net.URL(url)
    val proxy = NouProxy.javaProxy()
    val connection = (if (proxy != null) parsed.openConnection(proxy) else parsed.openConnection())
      as java.net.HttpURLConnection
    connection.connectTimeout = 10000
    connection.readTimeout = 10000
    connection.requestMethod = "GET"
    try {
      val status = connection.responseCode
      val ok = status in 200..299
      val stream = if (ok) connection.inputStream else (connection.errorStream ?: connection.inputStream)
      val body = stream.bufferedReader().use { it.readText() }
      return mapOf(
        "ok" to ok,
        "status" to status,
        "statusText" to (connection.responseMessage ?: ""),
        "body" to body,
      )
    } finally {
      connection.disconnect()
    }
  }

  private fun extractTakeoutCsvFiles(uri: String): List<Map<String, String>> {
    val cacheDir = requireNotNull(appContext.reactContext?.cacheDir) { "Cache directory is unavailable" }
    val importDir = File(cacheDir, "takeout-import-${System.currentTimeMillis()}").apply { mkdirs() }
    val results = mutableListOf<Map<String, String>>()

    openInputStream(uri).use { input ->
      ZipInputStream(input.buffered()).use { zip ->
        var entry = zip.nextEntry
        while (entry != null) {
          if (!entry.isDirectory) {
            val slugs = entry.name.split("/")
            val basename = slugs.lastOrNull()
            // Folder names inside Takeout are localized; importCsv (JS side)
            // detects the CSV type by row shape, so extract every .csv.
            if (basename != null && basename.endsWith(".csv", ignoreCase = true)) {
              val output = uniqueFile(importDir, basename)
              FileOutputStream(output).use { out ->
                zip.copyTo(out, DEFAULT_BUFFER_SIZE)
              }
              results.add(
                mapOf(
                  "name" to basename,
                  "uri" to Uri.fromFile(output).toString(),
                ),
              )
            }
          }
          zip.closeEntry()
          entry = zip.nextEntry
        }
      }
    }

    return results
  }

  private fun openInputStream(uri: String): InputStream {
    val parsedUri = Uri.parse(uri)
    if (parsedUri.scheme == "file" || parsedUri.scheme == null) {
      return FileInputStream(requireNotNull(parsedUri.path) { "Invalid file path: $uri" })
    }

    val resolver = requireNotNull(appContext.reactContext?.contentResolver) { "Content resolver is unavailable" }
    return requireNotNull(resolver.openInputStream(parsedUri)) { "Unable to open URI: $uri" }
  }

  private fun uniqueFile(dir: File, name: String): File {
    val dotIndex = name.lastIndexOf('.')
    val stem = if (dotIndex > 0) name.substring(0, dotIndex) else name
    val ext = if (dotIndex > 0) name.substring(dotIndex) else ""
    var candidate = File(dir, name)
    var index = 1
    while (candidate.exists()) {
      candidate = File(dir, "$stem-$index$ext")
      index += 1
    }
    return candidate
  }
}
