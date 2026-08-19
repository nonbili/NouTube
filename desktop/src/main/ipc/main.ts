import { setInterceptionBlocklist, toggleInterception } from 'main/lib/intercept.js'
import { openLoginWindow } from 'main/lib/login-window.js'
import { ensureYtDlp, updateYtDlp } from 'main/lib/ytdlp.js'
import { checkForUpdate, isUpdateSupported, quitAndInstall } from 'main/lib/auto-update.js'
import { consumePendingDeeplinks } from 'main/lib/deeplink.js'
import { MAIN_CHANNEL } from './constants.js'
import { uiClient } from './ui.js'
import { applyProxy, getProxyUrl } from 'main/lib/proxy.js'
import { ipcMain, session, app, shell, dialog, net } from 'electron'
import { spawn, exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

const interfaces = {
  clearData: () => {
    session.fromPartition('persist:webview').clearData()
    session.fromPartition('').clearData({ origins: ['https://music.youtube.com', 'https://www.youtube.com'] })
  },
  fetchFeed: async (url: string) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      // net.fetch routes through the Electron session (default partition), so it
      // honors the configured proxy; global fetch (undici) would bypass it.
      const res = await net.fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        body: await res.text(),
      }
    } catch (e) {
      console.error(`Failed to fetch feed from ${url}:`, e)
      throw e
    }
  },
  toggleInterception,
  setBlocklist: setInterceptionBlocklist,
  openLoginWindow,
  updateYtDlp,
  isUpdateSupported: () => isUpdateSupported,
  checkForUpdate,
  quitAndInstall,
  listFormats: async (url: string, useCookies = false): Promise<{ title: string; formats: FormatOption[] }> => {
    const binary = await ensureYtDlp()
    return withCookiesArgs(
      useCookies,
      (cookiesArgs) =>
        new Promise<{ title: string; formats: FormatOption[] }>((resolve, reject) => {
          const proc = spawn(binary, [...ytDlpProxyArgs(), ...cookiesArgs, '--dump-json', '--no-playlist', url])
          let stdout = ''
          let stderr = ''
          proc.stdout.on('data', (d) => (stdout += d))
          proc.stderr.on('data', (d) => (stderr += d))
          proc.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(stderr.slice(0, 300) || `yt-dlp exited with code ${code}`))
              return
            }
            try {
              const info = JSON.parse(stdout)
              resolve({
                title: info.title || '',
                formats: buildFormatOptions(info),
              })
            } catch {
              reject(new Error('Failed to parse yt-dlp output'))
            }
          })
        }),
    )
  },
  getDownloadsPath: (): string => app.getPath('downloads'),
  consumePendingDeeplinks,
  selectFolder: async (): Promise<string | null> => {
    const { mainWindow } = await import('main/lib/main-window.js')
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  },
  downloadVideo: async (url: string, formatId: string, outputDir: string, useCookies = false): Promise<void> => {
    const binary = await ensureYtDlp()
    // The format id is part of the name because the modal stays open for further formats of the
    // same video: with a plain title, a second format that lands on the same extension makes
    // yt-dlp skip the download as already-downloaded and nothing new is saved.
    const outputTemplate = `${outputDir}/%(title)s [%(format_id)s].%(ext)s`
    const isMp3 = formatId === 'bestaudio-mp3'
    // Exact-format-id picks (the full format list) can be VP9/AV1/Opus, which do not always
    // fit in mp4 — let yt-dlp choose the container for those.
    const isCuratedFormat = formatId.startsWith('bestvideo') || formatId.startsWith('bestaudio')
    return withCookiesArgs(useCookies, (cookiesArgs) => {
      const args = [
        ...ytDlpProxyArgs(),
        ...cookiesArgs,
        url,
        '-f',
        isMp3 ? 'bestaudio/best' : formatId,
        '-o',
        outputTemplate,
        '--no-playlist',
        ...(isMp3
          ? ['--extract-audio', '--audio-format', 'mp3', '--add-metadata', '--embed-thumbnail']
          : isCuratedFormat
            ? ['--merge-output-format', 'mp4']
            : []),
      ]
      return new Promise<void>((resolve, reject) => {
        const proc = spawn(binary, args)
        let filePath = ''
        let buffer = ''
        let lastLine = ''
        let lastUpdate = 0
        const THROTTLE_MS = 200
        // Progress lines are throttled and the trailing buffer is usually empty by the time
        // yt-dlp exits, so the lines explaining a failure are kept aside for the final update.
        const errorLines: string[] = []
        const MAX_ERROR_LINES = 5

        const onData = (d: Buffer) => {
          buffer += d.toString()
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            lastLine = line.trim()
            if (/^(ERROR|WARNING):/.test(lastLine)) {
              errorLines.push(lastLine)
              if (errorLines.length > MAX_ERROR_LINES) errorLines.shift()
            }

            // Parse final output path from yt-dlp progress lines
            const mergerMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
            const destMatch = line.match(/\[(?:download|ExtractAudio)\] Destination: (.+)/)
            // Re-downloading a format already on disk produces neither of the above
            const skippedMatch = line.match(/\[download\] (.+) has already been downloaded/)
            if (mergerMatch) filePath = mergerMatch[1].trim()
            else if (destMatch) filePath = destMatch[1].trim()
            else if (skippedMatch) filePath = skippedMatch[1].trim()

            const now = Date.now()
            if (now - lastUpdate > THROTTLE_MS) {
              uiClient.downloadProgress({ url, line: line.trim(), done: false })
              lastUpdate = now
            }
          }
        }
        proc.stdout.on('data', onData)
        proc.stderr.on('data', onData)
        proc.on('close', (code) => {
          const tail = buffer.trim()
          // Final update with the last line if any, and done=true. A failure reports everything
          // yt-dlp complained about, so the message shown to the user can be classified.
          uiClient.downloadProgress({
            url,
            line: code === 0 ? tail : [...errorLines, tail].filter(Boolean).join('\n') || lastLine,
            done: true,
            filePath,
            error: code !== 0,
          })

          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`))
          }
        })
      })
    })
  },
  openFolder: (filePath: string): void => {
    shell.showItemInFolder(filePath)
  },
  openFile: async (filePath: string): Promise<void> => {
    await shell.openPath(filePath)
  },
  setProxy: applyProxy,
  setCookie: async (cookie: string) => {
    const ses = session.fromPartition('persist:webview')
    const items = cookie.split(';').map((x) => x.trim())
    for (const item of items) {
      const index = item.indexOf('=')
      if (index === -1) continue
      const name = item.slice(0, index)
      const value = item.slice(index + 1)

      if (name && value) {
        const details: any = {
          url: 'https://www.youtube.com',
          name,
          value,
          path: '/',
          expirationDate: Math.floor(Date.now() / 1000) + 31536000,
        }

        if (name.startsWith('__Host-')) {
          details.secure = true
        } else {
          details.domain = '.youtube.com'
          if (name.startsWith('__Secure-')) {
            details.secure = true
          }
        }

        try {
          await ses.cookies.set(details)
        } catch (e) {
          console.error(`Failed to set cookie ${name}`, e)
        }
      }
    }
  },
}

function ytDlpProxyArgs(): string[] {
  const proxyUrl = getProxyUrl()
  return proxyUrl ? ['--proxy', proxyUrl] : []
}

// Exports the webview's YouTube cookies to a temporary Netscape cookie file for
// `yt-dlp --cookies`. yt-dlp cannot read the Electron cookie store, and passing
// them as a Cookie header does not work for YouTube.
async function writeCookiesFile(): Promise<string | null> {
  const cookies = await session.fromPartition('persist:webview').cookies.get({})
  const lines = cookies
    .filter((c) => c.domain?.endsWith('youtube.com') || c.domain?.endsWith('google.com'))
    .map((c) => {
      const domain = c.domain || ''
      const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE'
      const expiry = Math.floor(c.expirationDate ?? 0)
      return [domain, includeSubdomains, c.path || '/', c.secure ? 'TRUE' : 'FALSE', expiry, c.name, c.value].join('\t')
    })
  if (!lines.length) return null

  const filePath = path.join(app.getPath('temp'), `noutube-cookies-${Date.now()}.txt`)
  await fs.writeFile(filePath, `# Netscape HTTP Cookie File\n${lines.join('\n')}\n`, { mode: 0o600 })
  return filePath
}

// Runs `fn` with the yt-dlp `--cookies` args, cleaning up the temp file afterwards.
async function withCookiesArgs<T>(useCookies: boolean, fn: (args: string[]) => Promise<T>): Promise<T> {
  if (!useCookies) return fn([])

  let filePath: string | null = null
  try {
    filePath = await writeCookiesFile()
  } catch (e) {
    console.error('Failed to export cookies for yt-dlp', e)
  }
  try {
    return await fn(filePath ? ['--cookies', filePath] : [])
  } finally {
    if (filePath) {
      await fs.rm(filePath, { force: true }).catch(() => {})
    }
  }
}

export type FormatOption = {
  formatId: string
  label: string
  description: string
  advanced?: boolean
  // Video-independent descriptor of what the option is, used to match a pinned format
  // against the options of the next video. Absent on the curated options, which have
  // stable format ids of their own.
  kind?: 'video' | 'audio'
  height?: number
  fps?: number
  codec?: string
}

function buildFormatOptions(info: any): FormatOption[] {
  const formats: any[] = info.formats ?? []
  const options: FormatOption[] = []

  const maxHeight = Math.max(...formats.filter((f) => f.vcodec !== 'none' && f.height).map((f) => f.height), 0)

  // Only show "Best quality" when there's something above 1080p, otherwise 1080p option covers it
  if (maxHeight > 1080) {
    options.push({
      formatId: 'bestvideo+bestaudio/best',
      label: 'Best quality',
      description: `Up to ${maxHeight}p video + audio`,
    })
  }

  if (formats.some((f) => f.height === 1080 && f.vcodec !== 'none')) {
    options.push({
      formatId: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
      label: '1080p',
      description: '1080p video + audio',
    })
  }

  if (formats.some((f) => f.height === 720 && f.vcodec !== 'none')) {
    options.push({
      formatId: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
      label: '720p',
      description: '720p video + audio',
    })
  }

  const audioFormats = formats.filter((f) => f.vcodec === 'none' && f.acodec !== 'none')

  if (audioFormats.length) {
    options.push({
      formatId: 'bestaudio/best',
      label: 'Audio only',
      description: 'Best audio stream',
    })
    options.push({
      formatId: 'bestaudio-mp3',
      label: 'Audio (mp3)',
      description: 'MP3 audio with metadata and cover art',
    })
  }

  options.push(...buildAdvancedOptions(formats, audioFormats))

  return options
}

const CODEC_LABELS: [RegExp, string][] = [
  [/^(avc1|h264)/, 'H.264'],
  [/^(vp0?9)/, 'VP9'],
  [/^av01/, 'AV1'],
  [/^(vp0?8)/, 'VP8'],
  [/^opus/, 'Opus'],
  [/^(mp4a|aac)/, 'AAC'],
  [/^ec-3|^ac-3/, 'AC-3'],
]

function codecLabel(codec: string): string {
  const found = CODEC_LABELS.find(([re]) => re.test(codec))
  return found ? found[1] : codec.split('.')[0]
}

function formatSize(f: any): string {
  const bytes = f.filesize ?? f.filesize_approx
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  return mb >= 1024 ? `~${(mb / 1024).toFixed(1)} GB` : `~${Math.round(mb)} MB`
}

// Every distinct resolution/codec pair yt-dlp reports, so users are not limited to the
// handful of curated options above. Exact format ids are used instead of height/vcodec
// selectors, which yt-dlp cannot express reliably for codec families.
function buildAdvancedOptions(formats: any[], audioFormats: any[]): FormatOption[] {
  const options: FormatOption[] = []
  const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height > 0)

  const isVideoOnly = (f: any) => !f.acodec || f.acodec === 'none'

  const bestPerVariant = new Map<string, any>()
  for (const f of videoFormats) {
    const key = `${f.height}-${Math.round(f.fps || 0)}-${codecLabel(f.vcodec)}`
    const current = bestPerVariant.get(key)
    // Video-only wins over the muxed variant of the same resolution: it can be paired with
    // the best audio stream instead of the low-bitrate audio baked into the muxed format.
    const better =
      !current ||
      (isVideoOnly(f) && !isVideoOnly(current)) ||
      (isVideoOnly(f) === isVideoOnly(current) && (f.tbr || 0) > (current.tbr || 0))
    if (better) bestPerVariant.set(key, f)
  }

  const variants = Array.from(bestPerVariant.values()).sort(
    (a, b) => b.height - a.height || (b.fps || 0) - (a.fps || 0) || (b.tbr || 0) - (a.tbr || 0),
  )

  for (const f of variants) {
    const fps = Math.round(f.fps || 0)
    const size = formatSize(f)
    options.push({
      formatId: isVideoOnly(f) ? `${f.format_id}+bestaudio/best` : f.format_id,
      label: `${f.height}p${fps > 30 ? fps : ''} ${codecLabel(f.vcodec)}`,
      description: [f.ext?.toUpperCase(), size].filter(Boolean).join(' · ') || 'video + audio',
      advanced: true,
      kind: 'video',
      height: f.height,
      fps,
      codec: codecLabel(f.vcodec),
    })
  }

  const bestPerAudioCodec = new Map<string, any>()
  for (const f of audioFormats) {
    const key = codecLabel(f.acodec)
    const current = bestPerAudioCodec.get(key)
    if (!current || (f.abr || f.tbr || 0) > (current.abr || current.tbr || 0)) bestPerAudioCodec.set(key, f)
  }

  for (const f of bestPerAudioCodec.values()) {
    const abr = Math.round(f.abr || f.tbr || 0)
    options.push({
      formatId: f.format_id,
      label: `Audio ${codecLabel(f.acodec)}`,
      description: [f.ext?.toUpperCase(), abr ? `${abr} kbps` : '', formatSize(f)].filter(Boolean).join(' · '),
      advanced: true,
      kind: 'audio',
      codec: codecLabel(f.acodec),
    })
  }

  return options
}

export type MainInterface = typeof interfaces
type MainInterfaceKey = keyof MainInterface

function setupChannel() {
  ipcMain.handle(MAIN_CHANNEL, (_, name: string, ...args) => {
    console.log(MAIN_CHANNEL, name, JSON.stringify(args).slice(0, 100))
    const fn = interfaces[name as MainInterfaceKey]
    if (!fn) {
      console.error(`${fn} unimplemented`)
      return
    }
    // @ts-expect-error ??
    return fn(...args)
  })
}

export function initMainChannel() {
  setupChannel()
}
