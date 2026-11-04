package expo.modules.noutubeview

import java.net.InetSocketAddress
import java.net.Proxy

/**
 * Holds the currently configured proxy so non-WebView traffic (RSS feed fetching,
 * yt-dlp) can route through it too. The WebView itself is handled separately via
 * ProxyController.setProxyOverride in NouTubeViewModule.
 */
object NouProxy {
  @Volatile private var enabled: Boolean = false
  @Volatile private var type: String = "http"
  @Volatile private var host: String = ""
  @Volatile private var port: String = ""

  private var endpoint: ProxyEndpoint? = null
  private var relay: ProxyRelay? = null

  @Synchronized
  fun update(settings: NouSettings) {
    val next = if (settings.proxyEnabled && settings.proxyHost.isNotBlank()) {
      ProxyEndpoint(settings.proxyType, settings.proxyHost.trim(), settings.proxyPort.toIntOrNull() ?: 8080,
        settings.proxyUsername, settings.proxyPassword)
    } else null
    if (next != endpoint || relay?.isClosed == true) {
      val replacement = next?.takeIf { it.username.isNotEmpty() || it.password.isNotEmpty() }?.let {
        ProxyRelay(it) { nouController.log("Proxy relay stopped; reapply proxy settings to retry") }
      }
      val previous = relay
      relay = replacement
      endpoint = next
      previous?.close()
    }
    enabled = settings.proxyEnabled
    type = settings.proxyType
    host = settings.proxyHost
    port = settings.proxyPort
  }

  @Synchronized
  fun close() {
    relay?.close()
    relay = null
    endpoint = null
    enabled = false
  }

  /** A java.net.Proxy for HttpURLConnection, or null when disabled/invalid. */
  @Synchronized
  fun javaProxy(): Proxy? {
    relay?.let { return Proxy(Proxy.Type.SOCKS, InetSocketAddress("127.0.0.1", it.port)) }
    if (!enabled || host.isBlank()) return null
    val portInt = port.toIntOrNull() ?: return null
    val proxyType = if (type == "socks") Proxy.Type.SOCKS else Proxy.Type.HTTP
    return Proxy(proxyType, InetSocketAddress(host, portInt))
  }

  @Synchronized
  fun webViewRule(): String? = ytDlpUrl()?.replace("socks5://", "socks://")

  /** Proxy URL for yt-dlp's --proxy option, or null when disabled/invalid. */
  @Synchronized
  fun ytDlpUrl(): String? {
    relay?.let { return "socks5://127.0.0.1:${it.port}" }
    if (!enabled || host.isBlank()) return null
    val scheme = if (type == "socks") "socks5" else "http"
    val portStr = if (port.isNotBlank()) ":$port" else ""
    return "$scheme://$host$portStr"
  }
}
