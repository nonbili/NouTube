package expo.modules.noutubeview

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject

// Discord application the activity is attributed to. Artwork needs one: the
// thumbnail has to be registered through the application's external-assets
// endpoint before the gateway accepts it. Left empty, the presence shows
// without artwork. Keep in sync with lib/discord-presence.ts.
private const val APPLICATION_ID = "1557247525940105236"

private const val GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"
private const val API_URL = "https://discord.com/api/v10"

private const val OP_DISPATCH = 0
private const val OP_HEARTBEAT = 1
private const val OP_IDENTIFY = 2
private const val OP_PRESENCE_UPDATE = 3
private const val OP_RESUME = 6
private const val OP_RECONNECT = 7
private const val OP_INVALID_SESSION = 9
private const val OP_HELLO = 10
private const val OP_HEARTBEAT_ACK = 11

// The gateway allows five presence updates per 20 seconds.
private const val PRESENCE_INTERVAL_MS = 4000L
// Nothing playing for this long: stop holding a session open.
private const val IDLE_CLOSE_MS = 120_000L
// The page reports every second while it plays; silence means it is gone.
private const val STALE_PLAYBACK_MS = 20_000L
private const val MAX_RETRY_DELAY_MS = 60_000L
// How long to leave Discord alone after it turned the connection down for good.
private const val FATAL_BACKOFF_MS = 60_000L
// A seek or a rate change moves the start timestamp; ordinary playback only
// jitters it by the reporting delay.
private const val TIMESTAMP_TOLERANCE_MS = 3000L
// Discord rejects longer strings, and anything shorter than two characters.
private const val MAX_TEXT_LENGTH = 128
private const val CLOSE_ABNORMAL = 1006
private const val CLOSE_INVALID_TOKEN = 4004
// Reconnecting cannot fix these.
private val FATAL_CLOSE_CODES = setOf(4010, 4011, 4012, 4013, 4014)
// The session cannot be resumed after these, only started over.
private val SESSION_LOST_CLOSE_CODES = setOf(4007, 4009)
private val STATUSES = setOf("online", "idle", "dnd", "invisible")

private const val PREFS_NAME = "nou_discord"
private const val PREFS_TOKEN = "token"
private const val KEYSTORE = "AndroidKeyStore"
private const val KEY_ALIAS = "nou_discord"
private const val CIPHER = "AES/GCM/NoPadding"
private const val GCM_IV_BYTES = 12
private const val GCM_TAG_BITS = 128

// The token is a full login to the account, and app preferences travel with
// device backups. The key stays in the Keystore and does not, so a restored
// copy cannot be read and simply counts as logged out.
private object TokenCipher {
  private fun key(): SecretKey {
    val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .build()
    )
    return generator.generateKey()
  }

  fun encrypt(text: String): String {
    val cipher = Cipher.getInstance(CIPHER).apply { init(Cipher.ENCRYPT_MODE, key()) }
    return Base64.encodeToString(cipher.iv + cipher.doFinal(text.toByteArray()), Base64.NO_WRAP)
  }

  fun decrypt(stored: String): String {
    val bytes = Base64.decode(stored, Base64.NO_WRAP)
    val cipher = Cipher.getInstance(CIPHER)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(GCM_TAG_BITS, bytes, 0, GCM_IV_BYTES))
    return String(cipher.doFinal(bytes, GCM_IV_BYTES, bytes.size - GCM_IV_BYTES))
  }
}

private fun clip(text: String): String? {
  val trimmed = text.trim()
  if (trimmed.length < 2) return null
  return if (trimmed.length > MAX_TEXT_LENGTH) trimmed.take(MAX_TEXT_LENGTH - 1) + "…" else trimmed
}

private data class DiscordMedia(
  val title: String,
  val author: String,
  val durationMs: Long,
  val thumbnail: String,
  val music: Boolean
)

private data class DiscordActivity(
  val name: String,
  // 2 is "Listening to", 3 is "Watching".
  val type: Int,
  val details: String?,
  val state: String?,
  val image: String?,
  val start: Long,
  // 0 for a live stream.
  val end: Long
) {
  fun toJson(): JSONObject {
    val timestamps = JSONObject().put("start", start)
    if (end > 0) timestamps.put("end", end)
    val json = JSONObject()
      .put("name", name)
      .put("type", type)
      .put("timestamps", timestamps)
    details?.let { json.put("details", it) }
    state?.let { json.put("state", it) }
    if (APPLICATION_ID.isNotEmpty()) {
      json.put("application_id", APPLICATION_ID)
      image?.let {
        val assets = JSONObject().put("large_image", it)
        details?.let { text -> assets.put("large_text", text) }
        json.put("assets", assets)
      }
    }
    return json
  }

  /** Whether this is worth another presence update after [sent] went out. */
  fun differsFrom(sent: DiscordActivity): Boolean =
    name != sent.name ||
      details != sent.details ||
      state != sent.state ||
      image != sent.image ||
      kotlin.math.abs(start - sent.start) > TIMESTAMP_TOLERANCE_MS ||
      kotlin.math.abs(end - sent.end) > TIMESTAMP_TOLERANCE_MS
}

/**
 * Shows what is playing as the user's Discord activity, over a gateway session
 * opened with their own account token (there is no Discord client on the
 * device to hand it to). It lives here rather than in JS because React Native
 * stops its timers in the background, which is where most listening happens.
 *
 * Everything below runs on one thread; the public entry points only post to it.
 */
object NouDiscord {
  private val thread = HandlerThread("NouDiscord").apply { start() }
  private val handler = Handler(thread.looper)
  private val http = OkHttpClient()
  private var appContext: Context? = null

  @Volatile private var token: String? = null
  private var enabled = false
  private var media: DiscordMedia? = null
  private var playing = false
  private var positionMs = 0L
  // Playback speed; the clock Discord draws runs in real time, the video does not.
  private var rate = 1.0
  private var blockedUntil = 0L
  private var gateway: Gateway? = null
  private var sent: DiscordActivity? = null
  private var lastSentAt = 0L
  // A session that just came up shows whatever it showed before the connection
  // dropped, or nothing; either way it has to be told again.
  private var resend = false
  private var flushPosted = false
  private var idlePosted = false
  // Thumbnail url to the asset Discord registered for it; empty when it refused.
  private val images = HashMap<String, String>()

  /** Fired once when the login screen closes, whether or not it got a token. */
  @Volatile var onLoginFinished: (() -> Unit)? = null

  private val flushRunnable = Runnable {
    flushPosted = false
    flush()
  }
  private val idleRunnable = Runnable { closeGateway() }
  private val staleRunnable = Runnable {
    playing = false
    sync()
  }

  fun init(context: Context) {
    appContext = context.applicationContext
  }

  private fun prefs() = appContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun readToken(): String {
    token?.let { return it }
    val store = prefs() ?: return ""
    val stored = store.getString(PREFS_TOKEN, "") ?: ""
    val next = try {
      if (stored.isEmpty()) "" else TokenCipher.decrypt(stored)
    } catch (e: Exception) {
      // Restored from a backup, or the key is gone: log in again.
      nouController.log("discord token unreadable: ${e.message}")
      ""
    }
    token = next
    return next
  }

  fun isLoggedIn() = readToken().isNotEmpty()

  fun saveToken(next: String) {
    token = next
    val stored = try {
      if (next.isEmpty()) "" else TokenCipher.encrypt(next)
    } catch (e: Exception) {
      // No usable Keystore: keep it for this run only rather than in the clear.
      nouController.log("discord token not stored: ${e.message}")
      ""
    }
    prefs()?.edit()?.putString(PREFS_TOKEN, stored)?.apply()
    handler.post { sync() }
  }

  fun logout() {
    saveToken("")
    handler.post { images.clear() }
  }

  fun update(settings: NouSettings) {
    val next = settings.discordPresence
    val nextRate = settings.playbackRate
    handler.post {
      // The next progress tick picks a new rate up; it is a second away at most.
      rate = if (nextRate > 0) nextRate else 1.0
      if (enabled != next) {
        enabled = next
        sync()
      }
    }
  }

  fun setMedia(title: String, author: String, seconds: Long, thumbnail: String, music: Boolean) {
    handler.post {
      // The progress tick that follows carries the position, and with it the
      // update; going out now would show the new title at the old position.
      media = DiscordMedia(title, author, seconds * 1000, thumbnail, music)
    }
  }

  fun setProgress(isPlaying: Boolean, seconds: Long) {
    handler.post {
      playing = isPlaying
      positionMs = seconds * 1000
      handler.removeCallbacks(staleRunnable)
      if (isPlaying) {
        handler.postDelayed(staleRunnable, STALE_PLAYBACK_MS)
      }
      sync()
    }
  }

  fun clear() {
    handler.post {
      handler.removeCallbacks(staleRunnable)
      media = null
      playing = false
      closeGateway()
    }
  }

  private fun currentActivity(): DiscordActivity? {
    val current = media ?: return null
    if (!playing) return null
    // At 2x a ten minute video is over in five, so both ends of the progress
    // bar are in wall-clock time.
    // The rate is the saved one, which a live stream ignores: it plays at 1x.
    val live = current.durationMs <= 0
    val start = System.currentTimeMillis() - if (live) positionMs else (positionMs / rate).toLong()
    return DiscordActivity(
      name = if (current.music) "YouTube Music" else "YouTube",
      type = if (current.music) 2 else 3,
      details = clip(current.title),
      state = clip(current.author),
      image = resolveImage(current.thumbnail),
      start = start,
      end = if (live) 0 else start + (current.durationMs / rate).toLong()
    )
  }

  private fun sync() {
    val currentToken = readToken()
    if (!enabled || currentToken.isEmpty()) {
      closeGateway()
      return
    }
    if (media == null || !playing) {
      // Paused playback is hidden, the way Discord's own integrations do it.
      if (gateway != null) {
        scheduleFlush()
        if (!idlePosted) {
          idlePosted = true
          handler.postDelayed(idleRunnable, IDLE_CLOSE_MS)
        }
      }
      return
    }
    handler.removeCallbacks(idleRunnable)
    idlePosted = false
    if (gateway == null) {
      if (SystemClock.uptimeMillis() < blockedUntil) return
      gateway = Gateway(currentToken).also { it.connect() }
    }
    scheduleFlush()
  }

  private fun scheduleFlush() {
    if (flushPosted) return
    flushPosted = true
    val wait = lastSentAt + PRESENCE_INTERVAL_MS - SystemClock.uptimeMillis()
    handler.postDelayed(flushRunnable, maxOf(0L, wait))
  }

  private fun flush() {
    val current = gateway ?: return
    val activity = currentActivity()
    val previous = sent
    val changed = if (activity == null || previous == null) activity != previous else activity.differsFrom(previous)
    if (!changed && !resend) return
    if (current.setPresence(activity)) {
      sent = activity
      lastSentAt = SystemClock.uptimeMillis()
      resend = false
    }
  }

  private fun closeGateway() {
    handler.removeCallbacks(flushRunnable)
    handler.removeCallbacks(idleRunnable)
    flushPosted = false
    idlePosted = false
    gateway?.stop()
    gateway = null
    sent = null
    resend = false
  }

  private fun client(): OkHttpClient = http.newBuilder().proxy(NouProxy.javaProxy()).build()

  // The first update for a video goes out without artwork and a second one
  // follows once Discord has registered the thumbnail.
  private fun resolveImage(url: String): String? {
    if (APPLICATION_ID.isEmpty() || url.isEmpty()) return null
    images[url]?.let { return it.ifEmpty { null } }
    if (images.size > 100) images.clear()
    // A failure is remembered too: the presence is fine without artwork, and
    // asking again on every tick would only run into the rate limit.
    images[url] = ""
    val body = JSONObject().put("urls", JSONArray().put(url)).toString()
    val request = Request.Builder()
      .url("$API_URL/applications/$APPLICATION_ID/external-assets")
      .header("Authorization", readToken())
      .post(body.toRequestBody("application/json".toMediaType()))
      .build()
    client().newCall(request).enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        nouController.log("discord artwork failed: ${e.message}")
      }

      override fun onResponse(call: Call, response: Response) {
        val path = response.use {
          if (!it.isSuccessful) return
          try {
            JSONArray(it.body?.string() ?: "[]").optJSONObject(0)?.optString("external_asset_path") ?: ""
          } catch (e: Exception) {
            ""
          }
        }
        if (path.isEmpty()) return
        handler.post {
          images[url] = "mp:$path"
          scheduleFlush()
        }
      }
    })
    return null
  }

  private class Gateway(private val token: String) {
    private var ws: WebSocket? = null
    private var seq: Int? = null
    private var sessionId = ""
    private var resumeUrl = ""
    private var heartbeatMs = 0L
    private var acked = true
    private var ready = false
    private var stopped = false
    private var retries = 0
    private var status = "online"

    private val connectRunnable = Runnable { connect() }
    private val heartbeatRunnable = object : Runnable {
      override fun run() {
        // The last beat went unanswered: the connection is dead without having closed.
        if (!acked) {
          reconnect(0)
          return
        }
        acked = false
        send(OP_HEARTBEAT, seq ?: JSONObject.NULL)
        handler.postDelayed(this, heartbeatMs)
      }
    }

    /** False when there is no session to carry it yet; a flush follows once there is. */
    fun setPresence(activity: DiscordActivity?): Boolean {
      if (!ready) return false
      val activities = JSONArray()
      activity?.let { activities.put(it.toJson()) }
      send(
        OP_PRESENCE_UPDATE,
        JSONObject()
          .put("since", 0)
          .put("activities", activities)
          .put("status", status)
          .put("afk", true)
      )
      return true
    }

    fun stop() {
      stopped = true
      dropSocket(1000)
    }

    fun connect() {
      val resuming = sessionId.isNotEmpty() && resumeUrl.isNotEmpty()
      val request = Request.Builder()
        .url(if (resuming) "$resumeUrl/?v=10&encoding=json" else GATEWAY_URL)
        .build()
      ws = client().newWebSocket(request, object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
          handler.post { if (ws === webSocket) handleMessage(text, resuming) }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
          webSocket.close(1000, null)
          handler.post { if (ws === webSocket) handleClose(code) }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
          handler.post { if (ws === webSocket) handleClose(CLOSE_ABNORMAL) }
        }
      })
    }

    private fun handleMessage(raw: String, resuming: Boolean) {
      val payload = try {
        JSONObject(raw)
      } catch (e: Exception) {
        return
      }
      if (!payload.isNull("s")) {
        seq = payload.optInt("s")
      }
      when (payload.optInt("op", -1)) {
        OP_HELLO -> {
          heartbeatMs = payload.optJSONObject("d")?.optLong("heartbeat_interval", 0L)?.takeIf { it > 0 } ?: 41_250L
          acked = true
          handler.removeCallbacks(heartbeatRunnable)
          handler.postDelayed(heartbeatRunnable, (heartbeatMs * Math.random()).toLong())
          if (resuming) {
            send(
              OP_RESUME,
              JSONObject()
                .put("token", token)
                .put("session_id", sessionId)
                .put("seq", seq ?: JSONObject.NULL)
            )
          } else {
            send(
              OP_IDENTIFY,
              JSONObject()
                .put("token", token)
                .put("capabilities", 65)
                .put("compress", false)
                .put(
                  "properties",
                  JSONObject()
                    .put("os", "Android")
                    .put("browser", "Discord Client")
                    .put("device", "noutube")
                )
            )
          }
        }
        OP_DISPATCH -> onDispatch(payload.optString("t"), payload.opt("d"))
        OP_HEARTBEAT -> send(OP_HEARTBEAT, seq ?: JSONObject.NULL)
        OP_RECONNECT -> reconnect(0)
        OP_INVALID_SESSION -> {
          if (!payload.optBoolean("d", false)) {
            sessionId = ""
            seq = null
          }
          reconnect(1000 + (Math.random() * 4000).toLong())
        }
        OP_HEARTBEAT_ACK -> acked = true
      }
    }

    private fun onDispatch(type: String, data: Any?) {
      when (type) {
        "READY" -> {
          val ready = data as? JSONObject ?: return
          sessionId = ready.optString("session_id")
          resumeUrl = ready.optString("resume_gateway_url")
          updateStatus(ready.optJSONArray("sessions"))
          markReady()
        }
        "RESUMED" -> markReady()
        "SESSIONS_REPLACE" -> updateStatus(data as? JSONArray)
      }
    }

    private fun markReady() {
      ready = true
      retries = 0
      resend = true
      scheduleFlush()
    }

    // A presence update carries a status of its own, so follow what the user's
    // other clients show instead of forcing them online.
    private fun updateStatus(sessions: JSONArray?) {
      if (sessions == null) return
      var next = "online"
      for (i in 0 until sessions.length()) {
        val session = sessions.optJSONObject(i) ?: continue
        val id = session.optString("session_id")
        val sessionStatus = session.optString("status")
        if (id != sessionId && id != "all" && sessionStatus in STATUSES) {
          next = sessionStatus
          break
        }
      }
      status = next
    }

    private fun send(op: Int, d: Any) {
      ws?.send(JSONObject().put("op", op).put("d", d).toString())
    }

    private fun reconnect(delayMs: Long) {
      // Anything but a normal closure keeps the session resumable.
      dropSocket(4000)
      if (!stopped) {
        handler.postDelayed(connectRunnable, delayMs)
      }
    }

    private fun dropSocket(code: Int) {
      handler.removeCallbacks(heartbeatRunnable)
      handler.removeCallbacks(connectRunnable)
      val socket = ws
      ws = null
      ready = false
      socket?.close(code, null)
    }

    private fun handleClose(code: Int) {
      handler.removeCallbacks(heartbeatRunnable)
      ws = null
      ready = false
      if (stopped) return
      if (code == CLOSE_INVALID_TOKEN) {
        // Logged out elsewhere, or the password changed.
        stopped = true
        saveToken("")
        return
      }
      if (code in FATAL_CLOSE_CODES) {
        nouController.log("discord gateway closed for good: $code")
        // Dropping it lets playback try again later instead of never.
        blockedUntil = SystemClock.uptimeMillis() + FATAL_BACKOFF_MS
        closeGateway()
        return
      }
      if (code in SESSION_LOST_CLOSE_CODES) {
        sessionId = ""
        seq = null
      }
      val delay = minOf(MAX_RETRY_DELAY_MS, 1000L shl minOf(retries, 6))
      retries++
      handler.postDelayed(connectRunnable, delay)
    }
  }
}
