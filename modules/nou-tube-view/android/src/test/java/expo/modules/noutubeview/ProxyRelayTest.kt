package expo.modules.noutubeview

import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.ServerSocket
import java.net.Socket
import java.util.Base64
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test

class ProxyRelayTest {
  private val username = "user@/ name"
  private val password = "päss:@/% word"

  @Test fun httpAuthenticationAndTunnel() = verify("http", false)
  @Test fun socksAuthenticationAndTunnel() = verify("socks", false)
  @Test fun rejectedHttpAuthenticationFailsClosed() = verify("http", true)
  @Test fun rejectedSocksAuthenticationFailsClosed() = verify("socks", true)

  @Test fun socksIpv4AddressIsNotSentAsDomain() = verify("socks", false, "192.0.2.1")
  @Test fun socksIpv6AddressIsNotSentAsDomain() = verify("socks", false, "2001:db8::1")

  private fun verify(type: String, reject: Boolean, host: String = "destination.test") {
    val upstream = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
    val checked = CompletableFuture<Unit>()
    val thread = Thread {
      try {
        upstream.accept().use { socket ->
          socket.soTimeout = 5000
          val input = socket.getInputStream()
          val output = socket.getOutputStream()
          if (type == "http") {
            val header = StringBuilder()
            while (!header.endsWith("\r\n\r\n")) header.append(input.one().toChar())
            assertTrue(header.startsWith("CONNECT destination.test:443 HTTP/1.1\r\n"))
            val auth = Base64.getEncoder().encodeToString("$username:$password".toByteArray(Charsets.UTF_8))
            assertTrue(header.contains("Proxy-Authorization: Basic $auth\r\n"))
            output.write((if (reject) "HTTP/1.1 407 Rejected\r\n\r\n" else "HTTP/1.1 200 OK\r\n\r\n").toByteArray())
          } else {
            assertArrayEquals(byteArrayOf(5, 1, 2), input.exact(3))
            output.write(byteArrayOf(5, 2))
            assertEquals(1, input.one())
            assertEquals(username, String(input.exact(input.one()), Charsets.UTF_8))
            assertEquals(password, String(input.exact(input.one()), Charsets.UTF_8))
            output.write(byteArrayOf(1, if (reject) 1 else 0))
            if (!reject) {
              val addressType = if (host == "destination.test") 3 else if (host.contains(':')) 4 else 1
              assertArrayEquals(byteArrayOf(5, 1, 0, addressType.toByte()), input.exact(4))
              if (addressType == 3) assertEquals(host, String(input.exact(input.one())))
              else assertArrayEquals(InetAddress.getByName(host).address, input.exact(if (addressType == 1) 4 else 16))
              assertEquals(443, (input.one() shl 8) or input.one())
              output.write(byteArrayOf(5, 0, 0, 1, 127, 0, 0, 1, 0, 80))
            }
          }
          if (!reject) {
            assertEquals("payload", String(input.exact(7)))
            output.write("echo".toByteArray())
          }
          checked.complete(Unit)
        }
      } catch (error: Throwable) { checked.completeExceptionally(error) }
    }.apply { isDaemon = true; start() }
    ProxyRelay(ProxyEndpoint(type, "127.0.0.1", upstream.localPort, username, password)).use { relay ->
      try {
        Socket(Proxy(Proxy.Type.SOCKS, InetSocketAddress("127.0.0.1", relay.port))).use { socket ->
          socket.soTimeout = 5000
          val target = if (host == "destination.test") InetSocketAddress.createUnresolved(host, 443)
            else InetSocketAddress(host, 443)
          if (reject) {
            try {
              socket.connect(target, 5000)
              fail("Rejected credentials must not produce a tunnel")
            } catch (_: java.io.IOException) {}
          } else {
            socket.connect(target, 5000)
            socket.getOutputStream().write("payload".toByteArray())
            assertEquals("echo", String(socket.getInputStream().exact(4)))
          }
        }
        checked.get(5, TimeUnit.SECONDS)
      } finally { upstream.close(); thread.join(1000) }
    }
  }
}

private fun InputStream.one(): Int = read().also { check(it >= 0) }
private fun InputStream.exact(size: Int): ByteArray = ByteArray(size).also { bytes ->
  var offset = 0
  while (offset < size) {
    val count = read(bytes, offset, size - offset)
    check(count > 0)
    offset += count
  }
}
