import { createServer, createConnection, type Socket } from 'node:net'
import { once } from 'node:events'

export interface ProxyEndpoint {
  type?: 'http' | 'socks'
  host: string
  port: number
  username: string
  password: string
}

// Chromium cannot authenticate SOCKS proxies. A loopback SOCKS endpoint keeps
// credentials out of Chromium's proxy rules and authenticates upstream instead.
export async function startProxyRelay(upstream: ProxyEndpoint) {
  const sockets = new Set<Socket>()
  const track = (socket: Socket) => {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.on('close', () => sockets.delete(socket))
    socket.setTimeout(15_000, () => socket.destroy())
    return socket
  }
  const server = createServer((client) => {
    track(client)
    void connect(client).catch(() => client.destroy())
  })
  async function connect(client: Socket) {
    let remote: Socket | undefined
    client.on('close', () => remote?.destroy())
    try {
      const greeting = await read(client, 2)
      if (greeting[0] !== 5 || !(await read(client, greeting[1])).includes(0)) throw Error('SOCKS greeting rejected')
      client.write(Buffer.from([5, 0]))
      const request = await read(client, 4)
      if (request[0] !== 5 || request[1] !== 1) throw Error('Only CONNECT is supported')
      let host: string
      let address: Buffer
      if (request[3] === 3) {
        const length = (await read(client, 1))[0]
        if (!length) throw Error('Invalid destination')
        const name = await read(client, length)
        address = Buffer.concat([Buffer.from([3, length]), name])
        host = name.toString()
      } else if (request[3] === 1 || request[3] === 4) {
        const ip = await read(client, request[3] === 1 ? 4 : 16)
        address = Buffer.concat([Buffer.from([request[3]]), ip])
        host =
          request[3] === 1
            ? [...ip].join('.')
            : Array.from({ length: 8 }, (_, i) => ip.readUInt16BE(i * 2).toString(16)).join(':')
      } else throw Error('Invalid address type')
      const port = (await read(client, 2)).readUInt16BE()
      if (client.destroyed) throw Error('Client disconnected')
      remote = track(createConnection({ host: upstream.host, port: upstream.port }))
      await once(remote, 'connect')
      if (upstream.type === 'socks') await connectSocks(remote, upstream, address, port)
      else await connectHttp(remote, upstream, host, port)
      client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]))
      client.setTimeout(0)
      remote.setTimeout(0)
      if (client.destroyed) throw Error('Client disconnected')
      remote.on('close', () => client.destroy())
      client.pipe(remote).pipe(client)
    } catch {
      remote?.destroy()
      // Never include the upstream response (or credentials) in error logs.
      client.end(Buffer.from([5, 1, 0, 1, 0, 0, 0, 0, 0, 0]))
    }
  }
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw Error('Proxy relay did not bind')
  return {
    url: `socks5://127.0.0.1:${address.port}`,
    close() {
      server.close()
      for (const socket of sockets) socket.destroy()
    },
  }
}

async function read(socket: Socket, count: number): Promise<Buffer> {
  if (count === 0) return Buffer.alloc(0)
  for (;;) {
    const value = socket.read(count) as Buffer | null
    if (value) return value
    if (socket.destroyed || socket.readableEnded) throw Error('Proxy connection closed')
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off('readable', ready)
        socket.off('end', ended)
        socket.off('close', ended)
        socket.off('error', failed)
      }
      const ready = () => {
        cleanup()
        resolve()
      }
      const ended = () => {
        cleanup()
        reject(Error('Proxy connection closed'))
      }
      const failed = () => {
        cleanup()
        reject(Error('Proxy connection failed'))
      }
      socket.once('readable', ready)
      socket.once('end', ended)
      socket.once('close', ended)
      socket.once('error', failed)
    })
  }
}

async function connectHttp(socket: Socket, config: ProxyEndpoint, host: string, port: number) {
  const authority = `${host.includes(':') ? `[${host}]` : host}:${port}`
  if (/[\r\n]/.test(authority)) throw Error('Invalid destination')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')
  socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\nProxy-Authorization: Basic ${auth}\r\n\r\n`)
  let response = ''
  while (!response.endsWith('\r\n\r\n')) {
    if (response.length >= 16_384) throw Error('Proxy response too large')
    response += (await read(socket, 1)).toString('latin1')
  }
  if (!/^HTTP\/1\.[01] 2\d\d\b/.test(response)) throw Error('Proxy CONNECT rejected')
}

async function connectSocks(socket: Socket, config: ProxyEndpoint, address: Buffer, port: number) {
  socket.write(Buffer.from([5, 1, 2]))
  const method = await read(socket, 2)
  if (method[0] !== 5 || method[1] !== 2) throw Error('Proxy authentication unavailable')
  const username = Buffer.from(config.username)
  const password = Buffer.from(config.password)
  if (username.length > 255 || password.length > 255) throw Error('Proxy credentials too long')
  socket.write(Buffer.concat([Buffer.from([1, username.length]), username, Buffer.from([password.length]), password]))
  const auth = await read(socket, 2)
  if (auth[0] !== 1 || auth[1] !== 0) throw Error('Proxy authentication rejected')
  // Preserve ATYP and raw IP bytes; literal IPv6 addresses are not DNS names.
  socket.write(Buffer.concat([Buffer.from([5, 1, 0]), address, Buffer.from([port >> 8, port & 255])]))
  const reply = await read(socket, 4)
  if (reply[0] !== 5 || reply[1] !== 0) throw Error('Proxy CONNECT rejected')
  const size = reply[3] === 1 ? 4 : reply[3] === 4 ? 16 : reply[3] === 3 ? (await read(socket, 1))[0] : -1
  if (size < 0) throw Error('Invalid proxy response')
  await read(socket, size + 2)
}
