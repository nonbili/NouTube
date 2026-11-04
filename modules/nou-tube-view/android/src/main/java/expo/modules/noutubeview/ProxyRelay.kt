package expo.modules.noutubeview

import java.io.Closeable
import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

internal data class ProxyEndpoint(
  val type: String, val host: String, val port: Int,
  val username: String, val password: String,
)

/** Loopback SOCKS5 endpoint; only the upstream connection sees credentials. */
internal class ProxyRelay(
  private val upstream: ProxyEndpoint,
  private val onFailure: () -> Unit = {},
) : Closeable {
  private val server = ServerSocket(0, 32, InetAddress.getByName("127.0.0.1"))
  private val sockets = ConcurrentHashMap.newKeySet<Socket>()
  private val workers = Executors.newCachedThreadPool { runnable ->
    Thread(runnable, "NouTube proxy relay").apply { isDaemon = true }
  }
  val port: Int get() = server.localPort
  val isClosed: Boolean get() = server.isClosed

  init {
    workers.execute {
      while (!server.isClosed) {
        try {
          val client = server.accept()
          sockets.add(client)
          workers.execute { connect(client) }
        } catch (_: Exception) {
          if (!server.isClosed) {
            // Report once, without including exceptions or proxy credentials.
            runCatching { onFailure() }
            close()
          }
        }
      }
    }
  }

  private fun connect(client: Socket) {
    var remote: Socket? = null
    try {
      client.soTimeout = 15000
      val input = client.getInputStream()
      val output = client.getOutputStream()
      require(input.byte() == 5)
      require(input.bytes(input.byte()).contains(0.toByte()))
      output.write(byteArrayOf(5, 0))
      val request = input.bytes(4)
      require(request[0] == 5.toByte() && request[1] == 1.toByte())
      val address = when (request[3].toInt()) {
        3 -> {
          val length = input.byte()
          require(length > 0)
          byteArrayOf(3, length.toByte()) + input.bytes(length)
        }
        1 -> byteArrayOf(1) + input.bytes(4)
        4 -> byteArrayOf(4) + input.bytes(16)
        else -> error("Invalid SOCKS destination")
      }
      val host = if (address[0] == 3.toByte()) String(address.copyOfRange(2, address.size), Charsets.UTF_8)
        else InetAddress.getByAddress(address.copyOfRange(1, address.size)).hostAddress!!
      val port = (input.byte() shl 8) or input.byte()
      val upstreamSocket = Socket()
      remote = upstreamSocket
      sockets.add(upstreamSocket)
      upstreamSocket.soTimeout = 15000
      upstreamSocket.connect(InetSocketAddress(upstream.host, upstream.port), 15000)
      if (upstream.type == "socks") connectSocks(upstreamSocket, address, port)
      else connectHttp(upstreamSocket, host, port)
      output.write(byteArrayOf(5, 0, 0, 1, 0, 0, 0, 0, 0, 0))
      client.soTimeout = 0
      upstreamSocket.soTimeout = 0
      workers.execute {
        try { input.copyTo(upstreamSocket.getOutputStream()) } catch (_: Exception) {}
        finally { runCatching { upstreamSocket.shutdownOutput() } }
      }
      upstreamSocket.getInputStream().copyTo(output)
    } catch (_: Exception) {
      // Upstream responses and credentials must not reach logs.
      runCatching { client.getOutputStream().write(byteArrayOf(5, 1, 0, 1, 0, 0, 0, 0, 0, 0)) }
    } finally {
      runCatching { client.close() }
      remote?.let { runCatching { it.close() }; sockets.remove(it) }
      sockets.remove(client)
    }
  }

  private fun connectHttp(socket: Socket, host: String, port: Int) {
    require(!host.contains('\r') && !host.contains('\n'))
    val authority = "${if (host.contains(':')) "[$host]" else host}:$port"
    val auth = Base64.getEncoder().encodeToString("${upstream.username}:${upstream.password}".toByteArray(Charsets.UTF_8))
    socket.getOutputStream().write(
      "CONNECT $authority HTTP/1.1\r\nHost: $authority\r\nProxy-Authorization: Basic $auth\r\n\r\n".toByteArray(Charsets.UTF_8),
    )
    val input = socket.getInputStream()
    val response = StringBuilder()
    while (!response.endsWith("\r\n\r\n")) {
      require(response.length < 16384)
      response.append(input.byte().toChar())
    }
    require(Regex("HTTP/1\\.[01] 2\\d\\d\\b").containsMatchIn(response.toString().lineSequence().first()))
  }

  private fun connectSocks(socket: Socket, address: ByteArray, port: Int) {
    val output = socket.getOutputStream()
    val input = socket.getInputStream()
    output.write(byteArrayOf(5, 1, 2))
    require(input.byte() == 5 && input.byte() == 2)
    val username = upstream.username.toByteArray(Charsets.UTF_8)
    val password = upstream.password.toByteArray(Charsets.UTF_8)
    require(username.size <= 255 && password.size <= 255)
    output.write(byteArrayOf(1, username.size.toByte()) + username + byteArrayOf(password.size.toByte()) + password)
    require(input.byte() == 1 && input.byte() == 0)
    // Preserve the downstream address type, including raw IPv4/IPv6 bytes.
    output.write(byteArrayOf(5, 1, 0) + address + byteArrayOf((port shr 8).toByte(), port.toByte()))
    val reply = input.bytes(4)
    require(reply[0] == 5.toByte() && reply[1] == 0.toByte())
    val size = when (reply[3].toInt()) { 1 -> 4; 4 -> 16; 3 -> input.byte(); else -> error("Invalid SOCKS reply") }
    input.bytes(size + 2)
  }

  override fun close() {
    runCatching { server.close() }
    for (socket in sockets) runCatching { socket.close() }
    sockets.clear()
    workers.shutdownNow()
  }
}

private fun InputStream.byte(): Int = read().also { require(it >= 0) { "Proxy connection closed" } }
private fun InputStream.bytes(size: Int): ByteArray {
  val result = ByteArray(size)
  var offset = 0
  while (offset < size) {
    val count = read(result, offset, size - offset)
    require(count > 0) { "Proxy connection closed" }
    offset += count
  }
  return result
}
