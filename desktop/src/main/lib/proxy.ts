import { session } from 'electron'

export interface ProxyConfig {
  enabled?: boolean
  type?: 'http' | 'socks'
  host?: string
  port?: string
}

let currentProxyUrl: string | null = null

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
  currentProxyUrl = buildProxyUrl(config)
  await Promise.all(
    PROXIED_PARTITIONS.map((partition) => {
      const ses = partition ? session.fromPartition(partition) : session.defaultSession
      return currentProxyUrl
        ? ses.setProxy({ proxyRules: currentProxyUrl, proxyBypassRules: '<local>' })
        : ses.setProxy({ mode: 'direct' })
    }),
  )
}
