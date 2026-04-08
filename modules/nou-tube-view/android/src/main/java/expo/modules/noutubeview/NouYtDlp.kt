package expo.modules.noutubeview

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.webkit.MimeTypeMap
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.lang.reflect.Method
import org.json.JSONObject

internal class NouYtDlp(private val context: Context) {
  companion object {
    @Volatile
    private var youtubeDLInitialized = false

    @Volatile
    private var ffmpegInitialized = false
  }

  data class DownloadResult(
    val lastLine: String,
    val savedPath: String,
  )

  fun ensureInitialized() {
    ensureYoutubeDLInitialized()
    ensureFFmpegInitialized()
  }

  fun ensureYoutubeDLInitialized() {
    if (youtubeDLInitialized) return
    try {
      YoutubeDL.getInstance().init(context)
      youtubeDLInitialized = true
    } catch (e: Exception) {
      Log.e("NouTubeView", "Failed to initialize YoutubeDL", e)
      throw Exception("Failed to initialize YoutubeDL: ${e.message}")
    }
  }

  fun ensureFFmpegInitialized() {
    if (ffmpegInitialized) return
    try {
      FFmpeg.getInstance().init(context)
      ffmpegInitialized = true
    } catch (e: Exception) {
      Log.e("NouTubeView", "Failed to initialize FFmpeg", e)
      throw Exception("Failed to initialize FFmpeg: ${e.message}")
    }
  }

  fun listFormats(url: String): Map<String, Any> {
    ensureYoutubeDLInitialized()

    val request = YoutubeDLRequest(url)
    request.addOption("--dump-json")
    request.addOption("--no-playlist")
    request.addOption("-R", "1")
    request.addOption("--socket-timeout", "5")
    val response = YoutubeDL.getInstance().execute(request)
    val json = JSONObject(response.out ?: throw Exception("yt-dlp returned empty format output"))
    val formats = (0 until json.optJSONArray("formats")?.length().orZero())
      .mapNotNull { index -> json.optJSONArray("formats")?.optJSONObject(index) }

    val options = mutableListOf<Map<String, String>>()
    val videoFormats = formats.filter {
      it.optString("vcodec") != "none" && it.optInt("height", 0) > 0
    }
    val maxHeight = videoFormats.maxOfOrNull { it.optInt("height", 0) } ?: 0

    if (maxHeight > 1080) {
      options.add(
        mapOf(
          "formatId" to "bestvideo+bestaudio/best",
          "label" to "Best quality",
          "description" to "Up to ${maxHeight}p video + audio",
        ),
      )
    }

    if (videoFormats.any { it.optInt("height", 0) == 1080 }) {
      options.add(
        mapOf(
          "formatId" to "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
          "label" to "1080p",
          "description" to "1080p video + audio",
        ),
      )
    }

    if (videoFormats.any { it.optInt("height", 0) == 720 }) {
      options.add(
        mapOf(
          "formatId" to "bestvideo[height<=720]+bestaudio/best[height<=720]",
          "label" to "720p",
          "description" to "720p video + audio",
        ),
      )
    }

    if (formats.any { it.optString("vcodec") == "none" && it.optString("acodec") != "none" }) {
      options.add(
        mapOf(
          "formatId" to "bestaudio/best",
          "label" to "Audio only",
          "description" to "Best audio stream",
        ),
      )
    }

    return mapOf(
      "title" to json.optString("title"),
      "formats" to options,
    )
  }

  fun downloadVideo(
    url: String,
    formatId: String,
    outputDir: String,
    onProgress: (progress: Float, etaInSeconds: Long, line: String?) -> Unit,
  ): DownloadResult {
    ensureInitialized()

    val tempDir = File(context.cacheDir, "yt-dlp-download-${System.currentTimeMillis()}").apply { mkdirs() }
    val request = YoutubeDLRequest(url)
    request.addOption("-f", formatId)
    request.addOption("-o", "${tempDir.absolutePath}/%(title)s.%(ext)s")
    request.addOption("--no-playlist")
    request.addOption("--merge-output-format", "mp4")
    var lastLine = ""

    try {
      YoutubeDL.getInstance().execute(request) { progress, etaInSeconds, line ->
        lastLine = line ?: lastLine
        onProgress(progress, etaInSeconds, line)
      }

      val outputFile = tempDir
        .listFiles()
        ?.filter { it.isFile }
        ?.maxByOrNull { it.lastModified() }
        ?: throw Exception("Download completed but no output file was produced")
      val savedUri = publishToDownloads(outputFile)

      return DownloadResult(
        lastLine = lastLine,
        savedPath = savedUri.toString(),
      )
    } finally {
      tempDir.deleteRecursively()
    }
  }

  fun update() {
    val youtubeDL = YoutubeDL.getInstance()
    val updateChannel = runCatching { resolveStableUpdateChannel() }.getOrNull()

    val contextAndChannelMethod = updateChannel?.let { channel ->
      findUpdateYoutubeDLMethod(channel) { method ->
        method.parameterTypes.size == 2 &&
          isContextParameter(method.parameterTypes[0]) &&
          isUpdateChannelParameter(method.parameterTypes[1], channel)
      }
    }
    if (contextAndChannelMethod != null) {
      contextAndChannelMethod.invoke(youtubeDL, context, updateChannel)
      return
    }

    val channelOnlyMethod = updateChannel?.let { channel ->
      findUpdateYoutubeDLMethod(channel) { method ->
        method.parameterTypes.size == 1 &&
          isUpdateChannelParameter(method.parameterTypes[0], channel)
      }
    }
    if (channelOnlyMethod != null) {
      channelOnlyMethod.invoke(youtubeDL, updateChannel)
      return
    }

    val contextOnlyMethod = findUpdateYoutubeDLMethod(updateChannel) { method ->
      method.parameterTypes.size == 1 &&
        isContextParameter(method.parameterTypes[0])
    }
    if (contextOnlyMethod != null) {
      contextOnlyMethod.invoke(youtubeDL, context)
      return
    }

    val noArgMethod = findUpdateYoutubeDLMethod(updateChannel) { method ->
      method.parameterTypes.isEmpty()
    }
    if (noArgMethod != null) {
      noArgMethod.invoke(youtubeDL)
      return
    }

    throw Exception("updateYoutubeDL method not found")
  }

  private fun resolveStableUpdateChannel(): Any {
    val candidates = listOf(
      "com.yausername.youtubedl_android.YoutubeDL\$UpdateChannel",
      "com.yausername.youtubedl_android.UpdateChannel",
    )

    for (className in candidates) {
      try {
        val clazz = Class.forName(className)
        try {
          val stableField = clazz.getField("_STABLE")
          return stableField.get(null) ?: throw Exception("_STABLE update channel field is null")
        } catch (_: NoSuchFieldException) {
        }

        try {
          val stableField = clazz.getField("STABLE")
          return stableField.get(null) ?: throw Exception("STABLE update channel field is null")
        } catch (_: NoSuchFieldException) {
        }

        if (clazz.isEnum) {
          val stableEnum = clazz.enumConstants?.firstOrNull {
            (it as? Enum<*>)?.name == "STABLE"
          }
          if (stableEnum != null) {
            return stableEnum
          }
        }
      } catch (_: Exception) {
      }
    }

    throw Exception("Unable to resolve yt-dlp update channel")
  }

  private fun isContextParameter(parameterType: Class<*>): Boolean {
    return parameterType.isAssignableFrom(Context::class.java)
  }

  private fun isUpdateChannelParameter(parameterType: Class<*>, updateChannel: Any): Boolean {
    return parameterType.isAssignableFrom(updateChannel.javaClass)
  }

  private fun findUpdateYoutubeDLMethod(
    updateChannel: Any?,
    predicate: (Method) -> Boolean,
  ): Method? {
    val candidateNames = setOf("updateYoutubeDL", "updateYoutubeDl")

    return YoutubeDL::class.java.methods.firstOrNull { method ->
      method.name in candidateNames && predicate(method)
    } ?: if (updateChannel == null) {
      null
    } else {
      YoutubeDL::class.java.methods.firstOrNull { method ->
        method.name in candidateNames && method.parameterTypes.any { isUpdateChannelParameter(it, updateChannel) }
      }
    }
  }

  private fun publishToDownloads(sourceFile: File): Uri {
    val extension = sourceFile.extension.lowercase()
    val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension).orEmpty()
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, sourceFile.name)
      if (mimeType.isNotBlank()) {
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
      }
      put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    val resolver = context.contentResolver
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    val uri = resolver.insert(collection, values) ?: throw Exception("Failed to create download entry")

    try {
      resolver.openOutputStream(uri)?.use { output ->
        sourceFile.inputStream().use { input ->
          input.copyTo(output)
        }
      } ?: throw Exception("Failed to open MediaStore output stream")

      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
      return uri
    } catch (e: Exception) {
      resolver.delete(uri, null, null)
      throw e
    }
  }
}

private fun Int?.orZero(): Int = this ?: 0
