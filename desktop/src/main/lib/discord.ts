import { app, BrowserWindow, net, safeStorage, session } from 'electron'
import fs from 'fs'
import path from 'path'
import WebSocket from 'ws'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import {
  buildDiscordActivity,
  DISCORD_API_URL,
  DISCORD_APPLICATION_ID,
  DISCORD_GATEWAY_URL,
  isDiscordActivityChanged,
  parseDiscordPlayback,
  type DiscordActivity,
  type DiscordPlayback,
} from '@/lib/discord-presence'
import { getProxyUrl } from './proxy'

// Not persisted, so the Discord web session is gone once the window closes;
// only the token is kept.
const LOGIN_PARTITION = 'discord-login'
// Discord removes window.localStorage from its own pages; a fresh iframe still has it.
const READ_TOKEN_JS = `(() => {
  try {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const raw = frame.contentWindow.localStorage.getItem('token')
    frame.remove()
    return raw ? JSON.parse(raw) : ''
  } catch {
    return ''
  }
})()`

// The gateway allows five presence updates per 20 seconds.
const PRESENCE_INTERVAL_MS = 4000
// Nothing playing for this long: stop holding a session open.
const IDLE_CLOSE_MS = 120_000
// The page reports every few seconds while it plays; silence means its tab is gone.
const STALE_PLAYBACK_MS = 20_000
const MAX_RETRY_DELAY_MS = 60_000
// How long to leave Discord alone after it turned the connection down for good.
const FATAL_BACKOFF_MS = 60_000
const INVALID_TOKEN_CLOSE_CODE = 4004
// Reconnecting cannot fix these.
const FATAL_CLOSE_CODES = [4010, 4011, 4012, 4013, 4014]
// The session cannot be resumed after these, only started over.
const SESSION_LOST_CLOSE_CODES = [4007, 4009]
const STATUSES = ['online', 'idle', 'dnd', 'invisible']

const enum Op {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  Resume = 6,
  Reconnect = 7,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11,
}

class DiscordGateway {
  private ws?: WebSocket
  private seq: number | null = null
  private sessionId = ''
  private resumeUrl = ''
  private heartbeatTimer?: ReturnType<typeof setTimeout>
  private retryTimer?: ReturnType<typeof setTimeout>
  private acked = true
  private ready = false
  private stopped = false
  private retries = 0
  private status = 'online'

  constructor(
    private token: string,
    private onReady: () => void,
    private onInvalidToken: () => void,
    private onFatal: () => void,
  ) {
    this.connect()
  }

  /** False when there is no session to carry it yet; onReady fires once there is. */
  setPresence(activity: DiscordActivity | undefined): boolean {
    if (!this.ready) {
      return false
    }
    this.send(Op.PresenceUpdate, {
      since: 0,
      activities: activity ? [activity] : [],
      status: this.status,
      afk: true,
    })
    return true
  }

  stop(): void {
    this.stopped = true
    this.dropSocket(1000)
  }

  private connect(): void {
    const resuming = Boolean(this.sessionId && this.resumeUrl)
    const ws = new WebSocket(resuming ? `${this.resumeUrl}/?v=10&encoding=json` : DISCORD_GATEWAY_URL, {
      agent: proxyAgent(),
    })
    this.ws = ws
    ws.onmessage = (e): void => {
      if (this.ws === ws) {
        this.onMessage(String(e.data), resuming)
      }
    }
    ws.onclose = (e): void => {
      if (this.ws === ws) {
        this.onClose(e.code)
      }
    }
    // A close always follows, and that is where the retry lives.
    ws.onerror = (): void => {}
  }

  private onMessage(raw: string, resuming: boolean): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof payload.s === 'number') {
      this.seq = payload.s
    }
    switch (payload.op) {
      case Op.Hello:
        this.startHeartbeat(Number(payload.d?.heartbeat_interval) || 41_250)
        if (resuming) {
          this.send(Op.Resume, { token: this.token, session_id: this.sessionId, seq: this.seq })
        } else {
          this.send(Op.Identify, {
            token: this.token,
            capabilities: 65,
            compress: false,
            properties: { os: 'Windows', browser: 'Discord Client', device: 'noutube' },
          })
        }
        break
      case Op.Dispatch:
        this.onDispatch(payload.t, payload.d)
        break
      case Op.Heartbeat:
        this.send(Op.Heartbeat, this.seq)
        break
      case Op.Reconnect:
        this.reconnect()
        break
      case Op.InvalidSession:
        if (!payload.d) {
          this.sessionId = ''
          this.seq = null
        }
        this.reconnect(1000 + Math.random() * 4000)
        break
      case Op.HeartbeatAck:
        this.acked = true
        break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onDispatch(type: string, data: any): void {
    switch (type) {
      case 'READY':
        this.sessionId = String(data?.session_id || '')
        this.resumeUrl = String(data?.resume_gateway_url || '')
        this.updateStatus(data?.sessions)
        this.markReady()
        break
      case 'RESUMED':
        this.markReady()
        break
      case 'SESSIONS_REPLACE':
        this.updateStatus(data)
        break
    }
  }

  private markReady(): void {
    this.ready = true
    this.retries = 0
    this.onReady()
  }

  // A presence update carries a status of its own, so follow what the user's
  // other clients show instead of forcing them online.
  private updateStatus(sessions: unknown): void {
    if (!Array.isArray(sessions)) {
      return
    }
    const other = sessions.find(
      (s) => s?.session_id !== this.sessionId && s?.session_id !== 'all' && STATUSES.includes(s?.status),
    )
    this.status = other?.status ?? 'online'
  }

  private startHeartbeat(interval: number): void {
    clearTimeout(this.heartbeatTimer)
    this.acked = true
    const beat = (): void => {
      // The last beat went unanswered: the connection is dead without having closed.
      if (!this.acked) {
        this.reconnect()
        return
      }
      this.acked = false
      this.send(Op.Heartbeat, this.seq)
      this.heartbeatTimer = setTimeout(beat, interval)
    }
    this.heartbeatTimer = setTimeout(beat, interval * Math.random())
  }

  private send(op: Op, d: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d }))
    }
  }

  private reconnect(delay = 0): void {
    // Anything but a normal closure keeps the session resumable.
    this.dropSocket(4000)
    if (!this.stopped) {
      this.retryTimer = setTimeout(() => this.connect(), delay)
    }
  }

  private dropSocket(code: number): void {
    clearTimeout(this.heartbeatTimer)
    clearTimeout(this.retryTimer)
    const ws = this.ws
    this.ws = undefined
    this.ready = false
    try {
      ws?.close(code)
    } catch {
      // Already closing.
    }
  }

  private onClose(code: number): void {
    clearTimeout(this.heartbeatTimer)
    this.ws = undefined
    this.ready = false
    if (this.stopped) {
      return
    }
    if (code === INVALID_TOKEN_CLOSE_CODE) {
      this.stopped = true
      this.onInvalidToken()
      return
    }
    if (FATAL_CLOSE_CODES.includes(code)) {
      console.error('discord gateway closed for good', code)
      this.stopped = true
      this.onFatal()
      return
    }
    if (SESSION_LOST_CLOSE_CODES.includes(code)) {
      this.sessionId = ''
      this.seq = null
    }
    const delay = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** this.retries++)
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }
}

// Node's own sockets know nothing of the proxy the Electron sessions use, so
// the gateway connection has to be pointed at it by hand.
function proxyAgent(): HttpsProxyAgent<string> | SocksProxyAgent | undefined {
  const proxyUrl = getProxyUrl()
  if (!proxyUrl) {
    return undefined
  }
  // socks5h leaves the name lookup to the proxy, as Chromium does.
  return proxyUrl.startsWith('socks')
    ? new SocksProxyAgent(proxyUrl.replace(/^socks5:/, 'socks5h:'))
    : new HttpsProxyAgent(proxyUrl)
}

const tokenPath = (): string => path.join(app.getPath('userData'), 'discord-token')

let token: string | undefined

// Without a keyring to encrypt it the token stays in memory, and the next
// launch asks for the login again.
function loadToken(): string {
  if (token === undefined) {
    token = ''
    try {
      if (safeStorage.isEncryptionAvailable()) {
        token = safeStorage.decryptString(fs.readFileSync(tokenPath()))
      }
    } catch {
      // Never logged in, or the keyring changed.
    }
  }
  return token
}

function saveToken(next: string): void {
  token = next
  try {
    if (next && safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(tokenPath(), safeStorage.encryptString(next), { mode: 0o600 })
    } else {
      fs.rmSync(tokenPath(), { force: true })
    }
  } catch (e) {
    console.error('failed to store the discord token', e)
  }
}

let enabled = false
let playback: DiscordPlayback | undefined
let gateway: DiscordGateway | undefined
let sent: DiscordActivity | undefined
let lastSentAt = 0
// A session that just came up shows whatever it showed before the connection
// dropped, or nothing; either way it has to be told again.
let resend = false
let blockedUntil = 0
let flushTimer: ReturnType<typeof setTimeout> | undefined
let idleTimer: ReturnType<typeof setTimeout> | undefined
let staleTimer: ReturnType<typeof setTimeout> | undefined
const images = new Map<string, string>()

async function resolveImage(url: string): Promise<string | undefined> {
  if (!DISCORD_APPLICATION_ID || !url) {
    return undefined
  }
  const cached = images.get(url)
  if (cached !== undefined) {
    return cached || undefined
  }
  let image = ''
  try {
    const res = await net.fetch(`${DISCORD_API_URL}/applications/${DISCORD_APPLICATION_ID}/external-assets`, {
      method: 'POST',
      headers: { Authorization: loadToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
    })
    const assetPath = res.ok ? (await res.json())?.[0]?.external_asset_path : undefined
    if (typeof assetPath === 'string' && assetPath) {
      image = `mp:${assetPath}`
    }
  } catch (e) {
    console.error('failed to register the discord artwork', e)
  }
  if (images.size > 100) {
    images.clear()
  }
  // A failure is remembered too: the presence is fine without artwork, and
  // asking again on every tick would only run into the rate limit.
  images.set(url, image)
  return image || undefined
}

const shownPlayback = (): DiscordPlayback | undefined => (enabled && loadToken() ? playback : undefined)

async function flush(): Promise<void> {
  const current = shownPlayback()
  const image = current?.playing ? await resolveImage(current.thumbnail) : undefined
  // The lookup took a while and the player moved on; go again with what it reports now.
  if (current !== shownPlayback()) {
    scheduleFlush()
    return
  }
  const activity = buildDiscordActivity(current, Date.now(), image)
  if (!gateway || (!resend && !isDiscordActivityChanged(sent, activity))) {
    return
  }
  if (gateway.setPresence(activity)) {
    sent = activity
    lastSentAt = Date.now()
    resend = false
  }
}

function scheduleFlush(): void {
  if (flushTimer) {
    return
  }
  flushTimer = setTimeout(
    () => {
      flushTimer = undefined
      void flush()
    },
    Math.max(0, lastSentAt + PRESENCE_INTERVAL_MS - Date.now()),
  )
}

function closeGateway(): void {
  clearTimeout(flushTimer)
  clearTimeout(idleTimer)
  flushTimer = undefined
  idleTimer = undefined
  gateway?.stop()
  gateway = undefined
  sent = undefined
  resend = false
}

function sync(): void {
  if (!enabled || !loadToken()) {
    closeGateway()
    return
  }
  if (!playback?.playing) {
    if (gateway) {
      scheduleFlush()
      idleTimer ??= setTimeout(closeGateway, IDLE_CLOSE_MS)
    }
    return
  }
  clearTimeout(idleTimer)
  idleTimer = undefined
  if (!gateway && Date.now() < blockedUntil) {
    return
  }
  gateway ??= new DiscordGateway(
    loadToken(),
    () => {
      resend = true
      scheduleFlush()
    },
    () => {
      // Logged out elsewhere, or the password changed.
      saveToken('')
      closeGateway()
    },
    () => {
      // Dropping it lets playback try again later instead of never.
      blockedUntil = Date.now() + FATAL_BACKOFF_MS
      closeGateway()
    },
  )
  scheduleFlush()
}

export function getDiscordStatus(): { loggedIn: boolean } {
  return { loggedIn: Boolean(loadToken()) }
}

export function setDiscordPresence(next: boolean): void {
  enabled = Boolean(next)
  sync()
}

export function setDiscordPlayback(data: unknown): void {
  const next = parseDiscordPlayback(data)
  if (!next) {
    return
  }
  // Every tab reports its own player. The one on show keeps the presence
  // until it pauses or goes quiet, or two playing tabs would trade it back and
  // forth and a paused one would hide a playing one.
  if (playback?.playing && playback.source !== next.source) {
    return
  }
  playback = next
  clearTimeout(staleTimer)
  staleTimer = setTimeout(() => {
    playback = undefined
    sync()
  }, STALE_PLAYBACK_MS)
  sync()
}

export function discordLogout(): void {
  saveToken('')
  images.clear()
  sync()
}

let pendingLogin: Promise<{ loggedIn: boolean }> | undefined

/** Resolves once the login window is gone, with whether it yielded a token. */
export function discordLogin(): Promise<{ loggedIn: boolean }> {
  // A second request while the window is up waits on the same window.
  pendingLogin ??= openLoginWindow().finally(() => {
    pendingLogin = undefined
  })
  return pendingLogin
}

async function openLoginWindow(): Promise<{ loggedIn: boolean }> {
  const ses = session.fromPartition(LOGIN_PARTITION)
  const proxyUrl = getProxyUrl()
  await ses.setProxy(proxyUrl ? { proxyRules: proxyUrl, proxyBypassRules: '<local>' } : { mode: 'direct' })

  return new Promise<{ loggedIn: boolean }>((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 760,
      autoHideMenuBar: true,
      title: 'Discord',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        partition: LOGIN_PARTITION,
      },
    })
    let done = false
    let reading = false
    const readToken = async (): Promise<void> => {
      if (done || reading || win.isDestroyed()) {
        return
      }
      let pathname = ''
      try {
        pathname = new URL(win.webContents.getURL()).pathname
      } catch {
        return
      }
      // Discord lands here once the login went through.
      if (!/^\/(app|channels)(\/|$)/.test(pathname)) {
        return
      }
      reading = true
      const found = await win.webContents.executeJavaScript(READ_TOKEN_JS, true).catch(() => '')
      reading = false
      if (typeof found === 'string' && found && !done) {
        done = true
        saveToken(found)
        win.close()
      }
    }
    // The token is written a moment after the navigation, so keep looking.
    const timer = setInterval(readToken, 1000)
    win.webContents.on('did-navigate', readToken)
    win.webContents.on('did-navigate-in-page', readToken)
    win.on('closed', () => {
      clearInterval(timer)
      void ses.clearStorageData()
      sync()
      resolve(getDiscordStatus())
    })
    void win.loadURL('https://discord.com/login')
  })
}
