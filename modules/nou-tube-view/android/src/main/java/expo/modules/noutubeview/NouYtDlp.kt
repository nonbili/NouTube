package expo.modules.noutubeview

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.lang.reflect.Method
import org.json.JSONObject

internal class NouYtDlp(private val context: Context) {
  companion object {
    private val initializationLock = Any()

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
    synchronized(initializationLock) {
      if (youtubeDLInitialized) return
      try {
        YoutubeDL.getInstance().init(context)
        youtubeDLInitialized = true
      } catch (e: Exception) {
        Log.e("NouTubeView", "Failed to initialize YoutubeDL", e)
        throw Exception("Failed to initialize YoutubeDL: ${e.message}")
      }
    }
  }

  fun ensureFFmpegInitialized() {
    if (ffmpegInitialized) return
    synchronized(initializationLock) {
      if (ffmpegInitialized) return
      try {
        FFmpeg.getInstance().init(context)
        ffmpegInitialized = true
      } catch (e: Exception) {
        Log.e("NouTubeView", "Failed to initialize FFmpeg", e)
        throw Exception("Failed to initialize FFmpeg: ${e.message}")
      }
    }
  }

  // Exports the webview's YouTube cookies to a temporary Netscape cookie file for
  // `yt-dlp --cookies`. yt-dlp cannot read the webview cookie store, and passing
  // them as a Cookie header does not work for YouTube.
  private fun writeCookiesFile(): File? {
    val cookieHeader = runCatching {
      CookieManager.getInstance().getCookie("https://www.youtube.com")
    }.getOrNull()
    if (cookieHeader.isNullOrBlank()) return null

    val expiry = (System.currentTimeMillis() / 1000) + 31536000
    val lines = cookieHeader.split(";").mapNotNull { pair ->
      val index = pair.indexOf('=')
      if (index <= 0) return@mapNotNull null
      val name = pair.substring(0, index).trim()
      val value = pair.substring(index + 1).trim()
      if (name.isBlank()) null else ".youtube.com\tTRUE\t/\tTRUE\t$expiry\t$name\t$value"
    }
    if (lines.isEmpty()) return null

    return runCatching {
      File(context.cacheDir, "yt-dlp-cookies-${System.currentTimeMillis()}.txt").apply {
        writeText("# Netscape HTTP Cookie File\n${lines.joinToString("\n")}\n")
      }
    }.getOrNull()
  }

  fun listFormats(url: String, useCookies: Boolean): Map<String, Any> {
    ensureYoutubeDLInitialized()

    val cookiesFile = if (useCookies) writeCookiesFile() else null
    val request = YoutubeDLRequest(url)
    request.addOption("--dump-json")
    request.addOption("--no-playlist")
    request.addOption("-R", "1")
    request.addOption("--socket-timeout", "5")
    cookiesFile?.let { request.addOption("--cookies", it.absolutePath) }
    NouProxy.ytDlpUrl()?.let { request.addOption("--proxy", it) }
    val response = try {
      YoutubeDL.getInstance().execute(request)
    } finally {
      cookiesFile?.delete()
    }
    val json = JSONObject(response.out ?: throw Exception("yt-dlp returned empty format output"))
    val formats = (0 until json.optJSONArray("formats")?.length().orZero())
      .mapNotNull { index -> json.optJSONArray("formats")?.optJSONObject(index) }

    val options = mutableListOf<Map<String, Any>>()
    val videoFormats = formats.filter {
      it.optString("vcodec") != "none" && it.optInt("height", 0) > 0
    }
    val maxHeight = videoFormats.maxOfOrNull { it.optInt("height", 0) } ?: 0

    if (maxHeight > 1080) {
      options.add(
        mapOf(
          "formatId" to "bestvideo+bestaudio/best",
          "label" to nouController.t("format_bestQuality"),
          "description" to nouController.t("format_bestQualityDesc").replace("{{height}}", maxHeight.toString()),
        ),
      )
    }

    if (videoFormats.any { it.optInt("height", 0) == 1080 }) {
      options.add(
        mapOf(
          "formatId" to "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
          "label" to "1080p",
          "description" to nouController.t("format_1080pDesc"),
        ),
      )
    }

    if (videoFormats.any { it.optInt("height", 0) == 720 }) {
      options.add(
        mapOf(
          "formatId" to "bestvideo[height<=720]+bestaudio/best[height<=720]",
          "label" to "720p",
          "description" to nouController.t("format_720pDesc"),
        ),
      )
    }

    val audioFormats = formats.filter {
      it.optString("vcodec") == "none" && it.optString("acodec") != "none"
    }
    if (audioFormats.isNotEmpty()) {
      val best = audioFormats.maxByOrNull { it.optDouble("abr", it.optDouble("tbr", 0.0)) }
      val ext = best?.optString("ext").orEmpty()
      val label = if (ext.isNotBlank()) {
        nouController.t("format_audio").replace("{{ext}}", ext)
      } else {
        nouController.t("format_audioOnly")
      }
      options.add(
        mapOf(
          "formatId" to "bestaudio/best",
          "label" to label,
          "description" to nouController.t("format_audioStreamDesc"),
        ),
      )
      options.add(
        mapOf(
          "formatId" to "bestaudio-mp3",
          "label" to nouController.t("format_audio").replace("{{ext}}", "mp3"),
          "description" to nouController.t("format_audioMp3Desc"),
        ),
      )
    }

    options.addAll(buildAdvancedOptions(videoFormats, audioFormats))

    return mapOf(
      "title" to json.optString("title"),
      "formats" to options,
    )
  }

  private fun codecLabel(codec: String): String = when {
    codec.startsWith("avc1") || codec.startsWith("h264") -> "H.264"
    codec.startsWith("vp9") || codec.startsWith("vp09") -> "VP9"
    codec.startsWith("av01") -> "AV1"
    codec.startsWith("vp8") || codec.startsWith("vp08") -> "VP8"
    codec.startsWith("opus") -> "Opus"
    codec.startsWith("mp4a") || codec.startsWith("aac") -> "AAC"
    codec.startsWith("ac-3") || codec.startsWith("ec-3") -> "AC-3"
    else -> codec.substringBefore('.')
  }

  private fun formatSize(format: JSONObject): String {
    val bytes = format.optLong("filesize", 0L).takeIf { it > 0 }
      ?: format.optLong("filesize_approx", 0L).takeIf { it > 0 }
      ?: return ""
    val mb = bytes / 1024.0 / 1024.0
    return if (mb >= 1024) "~%.1f GB".format(mb / 1024) else "~%d MB".format(mb.toInt())
  }

  // Every distinct resolution/codec pair yt-dlp reports, so users are not limited to the
  // handful of curated options above. Exact format ids are used instead of height/vcodec
  // selectors, which yt-dlp cannot express reliably for codec families.
  private fun buildAdvancedOptions(
    videoFormats: List<JSONObject>,
    audioFormats: List<JSONObject>,
  ): List<Map<String, Any>> {
    val options = mutableListOf<Map<String, Any>>()

    val bestPerVariant = LinkedHashMap<String, JSONObject>()
    for (format in videoFormats) {
      val fps = format.optDouble("fps", 0.0).toInt()
      val key = "${format.optInt("height", 0)}-$fps-${codecLabel(format.optString("vcodec"))}"
      val current = bestPerVariant[key]
      // Video-only wins over the muxed variant of the same resolution: it can be paired with
      // the best audio stream instead of the low-bitrate audio baked into the muxed format.
      val better = current == null ||
        (format.isVideoOnly() && !current.isVideoOnly()) ||
        (format.isVideoOnly() == current.isVideoOnly() &&
          format.optDouble("tbr", 0.0) > current.optDouble("tbr", 0.0))
      if (better) {
        bestPerVariant[key] = format
      }
    }

    val variants = bestPerVariant.values.sortedWith(
      compareByDescending<JSONObject> { it.optInt("height", 0) }
        .thenByDescending { it.optDouble("fps", 0.0) }
        .thenByDescending { it.optDouble("tbr", 0.0) },
    )

    for (format in variants) {
      val fps = format.optDouble("fps", 0.0).toInt()
      val height = format.optInt("height", 0)
      val description = listOf(format.optString("ext").uppercase(), formatSize(format))
        .filter { it.isNotBlank() }
        .joinToString(" · ")
      options.add(
        mapOf(
          "formatId" to if (format.isVideoOnly()) {
            "${format.optString("format_id")}+bestaudio/best"
          } else {
            format.optString("format_id")
          },
          "label" to "${height}p${if (fps > 30) fps.toString() else ""} ${codecLabel(format.optString("vcodec"))}",
          "description" to description,
          "advanced" to true,
          "kind" to "video",
          "height" to height,
          "fps" to fps,
          "codec" to codecLabel(format.optString("vcodec")),
        ),
      )
    }

    val bestPerAudioCodec = LinkedHashMap<String, JSONObject>()
    for (format in audioFormats) {
      val key = codecLabel(format.optString("acodec"))
      val current = bestPerAudioCodec[key]
      if (current == null || format.audioBitrate() > current.audioBitrate()) {
        bestPerAudioCodec[key] = format
      }
    }

    for (format in bestPerAudioCodec.values) {
      val abr = format.audioBitrate().toInt()
      val description = listOf(
        format.optString("ext").uppercase(),
        if (abr > 0) "$abr kbps" else "",
        formatSize(format),
      ).filter { it.isNotBlank() }.joinToString(" · ")
      options.add(
        mapOf(
          "formatId" to format.optString("format_id"),
          "label" to "Audio ${codecLabel(format.optString("acodec"))}",
          "description" to description,
          "advanced" to true,
          "kind" to "audio",
          "codec" to codecLabel(format.optString("acodec")),
        ),
      )
    }

    return options
  }

  fun downloadVideo(
    url: String,
    formatId: String,
    outputDir: String,
    useCookies: Boolean,
    onProgress: (progress: Float, etaInSeconds: Long, line: String?) -> Unit,
  ): DownloadResult {
    ensureInitialized()

    val tempDir = File(context.cacheDir, "yt-dlp-download-${System.currentTimeMillis()}").apply { mkdirs() }
    val cookiesFile = if (useCookies) writeCookiesFile() else null
    val request = YoutubeDLRequest(url)
    val isMp3 = formatId == "bestaudio-mp3"
    request.addOption("-f", if (isMp3) "bestaudio/best" else formatId)
    // The format id is part of the name so downloads of several formats of the same video stay
    // tellable apart instead of landing as "title", "title (1)", "title (2)" in Downloads.
    request.addOption("-o", "${tempDir.absolutePath}/%(title)s [%(format_id)s].%(ext)s")
    request.addOption("--no-playlist")
    cookiesFile?.let { request.addOption("--cookies", it.absolutePath) }
    NouProxy.ytDlpUrl()?.let { request.addOption("--proxy", it) }
    // Exact-format-id picks (the full format list) can be VP9/AV1/Opus, which do not always
    // fit in mp4 — let yt-dlp choose the container for those.
    val isCuratedFormat = formatId.startsWith("bestvideo") || formatId.startsWith("bestaudio")
    if (isMp3) {
      request.addOption("--extract-audio")
      request.addOption("--audio-format", "mp3")
      request.addOption("--add-metadata")
      request.addOption("--embed-thumbnail")
    } else if (isCuratedFormat) {
      request.addOption("--merge-output-format", "mp4")
    }
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
      cookiesFile?.delete()
      tempDir.deleteRecursively()
    }
  }

  fun update() {
    ensureYoutubeDLInitialized()
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

private fun JSONObject.isVideoOnly(): Boolean = optString("acodec").let { it.isBlank() || it == "none" }

private fun JSONObject.audioBitrate(): Double = optDouble("abr", optDouble("tbr", 0.0))
