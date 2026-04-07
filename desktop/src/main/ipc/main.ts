import { toggleInterception } from 'main/lib/intercept.js'
import { openLoginWindow } from 'main/lib/login-window.js'
import { ensureYtDlp, updateYtDlp } from 'main/lib/ytdlp.js'
import { MAIN_CHANNEL } from './constants.js'
import { uiClient } from './ui.js'
import { ipcMain, session, app, shell, dialog } from 'electron'
import { spawn } from 'child_process'

const interfaces = {
  clearData: () => {
    session.fromPartition('persist:webview').clearData()
    session.fromPartition('').clearData({ origins: ['https://music.youtube.com', 'https://www.youtube.com'] })
  },
  fetchFeed: async (url: string) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(url, { signal: controller.signal })
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
  openLoginWindow,
  updateYtDlp,
  listFormats: async (url: string): Promise<{ title: string; formats: FormatOption[] }> => {
    const binary = await ensureYtDlp()
    return new Promise((resolve, reject) => {
      const proc = spawn(binary, ['--dump-json', '--no-playlist', url])
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
    })
  },
  getDownloadsPath: (): string => app.getPath('downloads'),
  selectFolder: async (): Promise<string | null> => {
    const { mainWindow } = await import('main/lib/main-window.js')
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  },
  downloadVideo: async (url: string, formatId: string, outputDir: string): Promise<void> => {
    const binary = await ensureYtDlp()
    const outputTemplate = `${outputDir}/%(title)s.%(ext)s`
    return new Promise((resolve, reject) => {
      const proc = spawn(binary, [
        url,
        '-f', formatId,
        '-o', outputTemplate,
        '--no-playlist',
        '--merge-output-format', 'mp4',
      ])
      let filePath = ''
      let buffer = ''
      let lastUpdate = 0
      const THROTTLE_MS = 200

      const onData = (d: Buffer) => {
        buffer += d.toString()
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          // Parse final output path from yt-dlp progress lines
          const mergerMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
          const destMatch = line.match(/\[(?:download|ExtractAudio)\] Destination: (.+)/)
          if (mergerMatch) filePath = mergerMatch[1].trim()
          else if (destMatch) filePath = destMatch[1].trim()

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
        // Final update with the last line if any, and done=true
        uiClient.downloadProgress({
          url,
          line: buffer.trim(),
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
  },
  openFolder: (filePath: string): void => {
    shell.showItemInFolder(filePath)
  },
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

export type FormatOption = { formatId: string; label: string; description: string }

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

  if (formats.some((f) => f.vcodec === 'none' && f.acodec !== 'none')) {
    options.push({
      formatId: 'bestaudio/best',
      label: 'Audio only',
      description: 'Best audio stream',
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
