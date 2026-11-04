import { describe, expect, it } from 'bun:test'
import { createServer, type Socket } from 'node:net'
import { once } from 'node:events'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { startProxyRelay } from '../desktop/src/main/lib/proxy-relay'

const username = 'user@/ name'
const password = 'päss:@/% word'

async function fixture(type: 'http' | 'socks', reject = false) {
  const received: string[] = []
  const addressTypes: number[] = []
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.on('close', () => sockets.delete(socket))
    let data = Buffer.alloc(0)
    let stage = type === 'http' ? 'http' : 'greeting'
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk])
      for (;;) {
        if (stage === 'echo') {
          socket.write(data)
          data = Buffer.alloc(0)
          return
        }
        if (stage === 'http') {
          const end = data.indexOf('\r\n\r\n')
          if (end < 0) return
          received.push(data.subarray(0, end).toString())
          data = data.subarray(end + 4)
          socket.write(
            reject
              ? 'HTTP/1.1 407 Proxy Authentication Required\r\n\r\n'
              : 'HTTP/1.1 200 Connection Established\r\n\r\n',
          )
          stage = 'echo'
          if (reject) {
            socket.end()
            return
          }
        } else if (stage === 'greeting') {
          if (data.length < 3) return
          received.push(data.subarray(0, 3).toString('hex'))
          data = data.subarray(3)
          socket.write(Buffer.from([5, 2]))
          stage = 'auth'
        } else if (stage === 'auth') {
          if (data.length < 2 || data.length < 3 + data[1]) return
          const length = 3 + data[1] + data[2 + data[1]]
          if (data.length < length) return
          received.push(data.subarray(2, 2 + data[1]).toString())
          received.push(data.subarray(3 + data[1], length).toString())
          data = data.subarray(length)
          socket.write(Buffer.from([1, reject ? 1 : 0]))
          if (reject) {
            socket.end()
            return
          }
          stage = 'connect'
        } else if (stage === 'connect') {
          if (data.length < 5) return
          const type = data[3]
          const offset = type === 3 ? 5 : 4
          const size = type === 1 ? 4 : type === 4 ? 16 : data[4]
          if (data.length < offset + size + 2) return
          addressTypes.push(type)
          const address = data.subarray(offset, offset + size)
          received.push(`${address.toString(type === 3 ? 'utf8' : 'hex')}:${data.readUInt16BE(offset + size)}`)
          data = data.subarray(offset + size + 2)
          socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 80]))
          stage = 'echo'
        }
        if (!data.length) return
      }
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = (server.address() as { port: number }).port
  const relay = await startProxyRelay({ type, host: '127.0.0.1', port, username, password })
  return {
    received,
    addressTypes,
    relay,
    async client(host = 'destination.test') {
      const agent = new SocksProxyAgent(relay.url.replace('socks5:', 'socks5h:'))
      return agent.connect({ destroy() {} } as any, { host, port: 443, secureEndpoint: false })
    },
    close() {
      relay.close()
      for (const socket of sockets) socket.destroy()
      server.close()
    },
  }
}

describe('authenticated proxy relay', () => {
  for (const [host, type, address] of [
    ['192.0.2.1', 1, 'c0000201'],
    ['2001:db8::1', 4, '20010db8000000000000000000000001'],
  ] as const) {
    it(`preserves the SOCKS address type for ${host}`, async () => {
      const test = await fixture('socks')
      try {
        const socket = await test.client(host)
        expect(test.addressTypes).toEqual([type])
        expect(test.received.at(-1)).toBe(`${address}:443`)
        socket.destroy()
      } finally {
        test.close()
      }
    })
  }

  for (const type of ['http', 'socks'] as const) {
    it(`authenticates ${type} upstream and relays data without local DNS`, async () => {
      const test = await fixture(type)
      try {
        const socket = await test.client()
        const response = once(socket, 'data')
        socket.write('tunnel payload')
        expect((await response)[0].toString()).toBe('tunnel payload')
        if (type === 'http') {
          expect(test.received[0]).toContain('CONNECT destination.test:443 HTTP/1.1')
          expect(test.received[0]).toContain(
            `Proxy-Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
          )
        } else {
          expect(test.received).toEqual(['050102', username, password, 'destination.test:443'])
        }
        const closed = once(socket, 'close')
        test.relay.close()
        await closed
        socket.destroy()
      } finally {
        test.close()
      }
    })

    it(`rejects failed ${type} authentication instead of connecting directly`, async () => {
      const test = await fixture(type, true)
      try {
        await expect(test.client()).rejects.toThrow()
      } finally {
        test.close()
      }
    })
  }
})
