package expo.modules.noutubeview

import android.net.Uri
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
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
  private fun ytDlp(): NouYtDlp {
    val context = appContext.reactContext?.applicationContext ?: throw Exception("Application context is unavailable")
    return NouYtDlp(context)
  }

  init {
    nouController.logFn = { msg: String ->
      sendEvent("log", mapOf("msg" to msg))
    }
    nouController.sleepTimerEventFn = { payload ->
      sendEvent("sleepTimer", payload)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NouTubeView")

    Events("log", "sleepTimer", "downloadProgress")

    OnCreate {
      try {
        ytDlp().ensureInitialized()
        sendEvent("log", mapOf("msg" to "YoutubeDL initialized successfully"))
      } catch (e: Exception) {
        // Log it, but the actual error will be thrown in the AsyncFunctions
        Log.e("NouTubeView", "YoutubeDL initialization in OnCreate failed", e)
        sendEvent("log", mapOf("msg" to "YoutubeDL initialization failed: ${e.message}"))
      }
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

    AsyncFunction("listFormats") Coroutine { url: String ->
      return@Coroutine ytDlp().listFormats(url)
    }

    AsyncFunction("downloadVideo") Coroutine { url: String, formatId: String, outputDir: String ->
      try {
        val result = ytDlp().downloadVideo(url, formatId, outputDir) { progress, etaInSeconds, line ->
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

    AsyncFunction("getDownloadsPath") {
      android.os.Environment.DIRECTORY_DOWNLOADS
    }

    AsyncFunction("updateYtDlp") {
      ytDlp().update()
    }

    View(NouTubeView::class) {
      Prop("scriptOnStart") { view: NouTubeView, script: String ->
        view.setScriptOnStart(script)
      }

      Prop("useragent") { view: NouTubeView, ua: String ->
        view.webView.settings.setUserAgentString(ua)
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

  private fun extractTakeoutCsvFiles(uri: String): List<Map<String, String>> {
    val cacheDir = requireNotNull(appContext.reactContext?.cacheDir) { "Cache directory is unavailable" }
    val importDir = File(cacheDir, "takeout-import-${System.currentTimeMillis()}").apply { mkdirs() }
    val results = mutableListOf<Map<String, String>>()
    val targetFolders = setOf("music (library and uploads)", "playlists", "subscriptions")

    openInputStream(uri).use { input ->
      ZipInputStream(input.buffered()).use { zip ->
        var entry = zip.nextEntry
        while (entry != null) {
          if (!entry.isDirectory) {
            val slugs = entry.name.split("/")
            val folder = slugs.getOrNull(2)?.lowercase()
            val basename = slugs.lastOrNull()
            if (basename != null && basename.endsWith(".csv", ignoreCase = true) && folder in targetFolders) {
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
