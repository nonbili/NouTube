import { app } from 'electron'
import { join } from 'path'
import { existsSync, chmodSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'

const BINARY_URLS: Record<string, string> = {
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
}

export function getYtDlpPath(): string {
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return join(app.getPath('userData'), name)
}

async function getLocalVersion(): Promise<string | null> {
  const binaryPath = getYtDlpPath()
  if (!existsSync(binaryPath)) return null

  return new Promise((resolve) => {
    const proc = spawn(binaryPath, ['--version'])
    let stdout = ''
    proc.stdout.on('data', (d) => (stdout += d))
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else resolve(null)
    })
    proc.on('error', () => resolve(null))
  })
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest')
    if (!res.ok) return null
    const data = await res.json() as any
    return data.tag_name
  } catch {
    return null
  }
}

export async function updateYtDlp(force = false): Promise<string> {
  const binaryPath = getYtDlpPath()
  const url = BINARY_URLS[process.platform]
  if (!url) {
    throw new Error(`Unsupported platform: ${process.platform}`)
  }

  if (!force) {
    const [local, latest] = await Promise.all([getLocalVersion(), getLatestVersion()])
    if (local && latest && latest.includes(local)) {
      console.log(`yt-dlp is already up to date (${local})`)
      return binaryPath
    }
  }

  console.log(`Updating yt-dlp from ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: ${res.status} ${res.statusText}`)
  }

  const buffer = await res.arrayBuffer()
  writeFileSync(binaryPath, Buffer.from(buffer))

  if (process.platform !== 'win32') {
    chmodSync(binaryPath, 0o755)
  }

  console.log(`yt-dlp updated at ${binaryPath}`)
  return binaryPath
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
