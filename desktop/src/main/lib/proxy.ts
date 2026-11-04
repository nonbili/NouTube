import { session } from 'electron'
import { startProxyRelay } from './proxy-relay'

export interface ProxyConfig {
  enabled?: boolean
  type?: 'http' | 'socks'
  host?: string
  port?: string
  username?: string
  password?: string
}

let currentProxyUrl: string | null = null
let relay: Awaited<ReturnType<typeof startProxyRelay>> | undefined
let revision = 0

/** Proxy URL usable by external processes (e.g. yt-dlp `--proxy`), or null when disabled. */
export function getProxyUrl(): string | null {
  return currentProxyUrl
}

function buildProxyUrl(config: ProxyConfig): string | null {
  const host = config.host?.trim()
  const port = config.port?.trim()
  if (!config.enabled || !host || !port) {
    return null
  }
  const scheme = config.type === 'socks' ? 'socks5' : 'http'
  return `${scheme}://${host}:${port}`
}

// Both the YouTube webview (and login window) and any main-process `net.fetch`
// go through these two sessions, so applying the proxy to both routes all app
// traffic — browsing plus RSS feeds — through it.
const PROXIED_PARTITIONS = ['persist:webview', ''] as const

export async function applyProxy(config: ProxyConfig): Promise<void> {
  const version = ++revision
  const directUrl = buildProxyUrl(config)
  let nextRelay: typeof relay
  if (directUrl && (config.username || config.password)) {
    nextRelay = await startProxyRelay({
      type: config.type,
      host: config.host!.trim(),
      port: Number(config.port),
      username: config.username || '',
      password: config.password || '',
    })
  }
  if (version !== revision) {
    nextRelay?.close()
    return
  }
  const previousRelay = relay
  relay = nextRelay
  currentProxyUrl = nextRelay?.url || directUrl
  await Promise.all(
    PROXIED_PARTITIONS.map((partition) => {
      const ses = partition ? session.fromPartition(partition) : session.defaultSession
      return currentProxyUrl
        ? ses.setProxy({ proxyRules: currentProxyUrl, proxyBypassRules: '<local>' })
        : ses.setProxy({ mode: 'direct' })
    }),
  )
  previousRelay?.close()
}
