// Run in a separate process so Electron mocks do not affect other tests.
import { mock } from 'bun:test'
import * as childProcess from 'node:child_process'

const mode = process.argv[2]
let invoke: (_event: unknown, name: string, ...args: unknown[]) => Promise<void>
const progress: unknown[] = []
let finish!: () => void
const finished = new Promise<void>((resolve) => { finish = resolve })
const spawn = childProcess.spawn

mock.module('electron', () => ({
  app: {}, BrowserWindow: class {}, safeStorage: {}, net: {}, session: {}, shell: {}, dialog: {},
  ipcMain: { handle(_channel: string, handler: typeof invoke) { invoke = handler } },
}))
mock.module('main/lib/intercept.js', () => ({
  setInterceptionBlockAds() {}, setInterceptionBlocklist() {}, toggleInterception() {},
}))
mock.module('main/lib/login-window.js', () => ({ openLoginWindow() {} }))
mock.module('main/lib/deeplink.js', () => ({ consumePendingDeeplinks() {} }))
mock.module('main/lib/proxy.js', () => ({ applyProxy() {}, getProxyUrl: () => null }))
mock.module('main/lib/discord.js', () => ({
  discordLogin() {}, discordLogout() {}, getDiscordStatus() {}, setDiscordPlayback() {}, setDiscordPresence() {},
}))
mock.module('main/lib/thumbar.js', () => ({ setTaskbarControls() {} }))
mock.module('main/lib/auto-update.js', () => ({
  isUpdateSupported: false, checkForUpdate() {}, quitAndInstall() {},
}))
mock.module('main/lib/ytdlp.js', () => ({
  async ensureYtDlp() {
    if (mode === 'setup') throw new Error('Failed to download yt-dlp: 503 Service Unavailable')
    return '/missing/noutube-test-yt-dlp'
  },
  updateYtDlp() {},
}))
mock.module('../desktop/src/main/ipc/ui', () => ({
  uiClient: { downloadProgress(payload: { done: boolean }) {
    progress.push(payload)
    if (payload.done) finish()
  } },
}))
mock.module('child_process', () => ({
  ...childProcess,
  spawn(binary: string, args: string[]) {
    if (mode === 'missing') return spawn(binary, args)
    const script = mode === 'success'
      ? 'console.log("[download] Destination: /tmp/example.mp4"); process.exit(0)'
      : 'console.error("ERROR: Requested format is not available"); process.exit(1)'
    return spawn(process.execPath, ['--eval', script])
  },
}))

const { initMainChannel } = await import('../desktop/src/main/ipc/main')
initMainChannel()
let error = ''
try {
  await invoke!(null, 'downloadVideo', 'https://www.youtube.com/watch?v=abcdefghijk', 'bestaudio', '/tmp', false)
} catch (e) {
  error = (e as Error).message
}
if (mode !== 'setup') await finished
console.log(JSON.stringify({ error, progress }))
