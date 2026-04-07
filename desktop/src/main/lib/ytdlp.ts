import { app } from 'electron'
import { join } from 'path'
import { existsSync, createWriteStream, chmodSync } from 'fs'

const BINARY_URLS: Record<string, string> = {
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
}

export function getYtDlpPath(): string {
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return join(app.getPath('userData'), name)
}

export async function ensureYtDlp(): Promise<string> {
  const binaryPath = getYtDlpPath()
  if (existsSync(binaryPath)) {
    return binaryPath
  }

  const url = BINARY_URLS[process.platform]
  if (!url) {
    throw new Error(`Unsupported platform: ${process.platform}`)
  }

  console.log(`Downloading yt-dlp from ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: ${res.status} ${res.statusText}`)
  }

  const buffer = await res.arrayBuffer()
  const { writeFileSync } = await import('fs')
  writeFileSync(binaryPath, Buffer.from(buffer))

  if (process.platform !== 'win32') {
    chmodSync(binaryPath, 0o755)
  }

  console.log(`yt-dlp downloaded to ${binaryPath}`)
  return binaryPath
}
