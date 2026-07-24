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

  fun update(settings: NouSettings) {
    enabled = settings.proxyEnabled
    type = settings.proxyType
    host = settings.proxyHost
    port = settings.proxyPort
  }

  /** A java.net.Proxy for HttpURLConnection, or null when disabled/invalid. */
  fun javaProxy(): Proxy? {
    if (!enabled || host.isBlank()) return null
    val portInt = port.toIntOrNull() ?: return null
    val proxyType = if (type == "socks") Proxy.Type.SOCKS else Proxy.Type.HTTP
    return Proxy(proxyType, InetSocketAddress(host, portInt))
  }

  /** Proxy URL for yt-dlp's --proxy option, or null when disabled/invalid. */
  fun ytDlpUrl(): String? {
    if (!enabled || host.isBlank()) return null
    val scheme = if (type == "socks") "socks5" else "http"
    val portStr = if (port.isNotBlank()) ":$port" else ""
    return "$scheme://$host$portStr"
  }
}
