#!/usr/bin/env bun

import { dirname, resolve } from 'node:path'

type PackageInfo = {
  version: string
  versionCode: number
  buildNumber: string
}

export const repoRoot = resolve(import.meta.dir, '..')

export const envFlag = (name: string, defaultValue: boolean) => {
  const value = process.env[name]
  if (value == null || value === '') {
    return defaultValue
  }

  return value !== '0'
}

export const requireEnv = (name: string) => {
  const value = process.env[name]
  if (!value) {
    fail(`${name} is required.`)
  }

  return value
}

export const packageInfo = async (): Promise<PackageInfo> => (
  await Bun.file(resolve(repoRoot, 'package.json')).json()
)

export const fileExists = async (path: string) => (
  await Bun.file(path).exists()
)

export const ensureFile = async (path: string, message: string) => {
  if (!(await fileExists(path))) {
    fail(message)
  }
}

export const copyFile = async (source: string, destination: string) => {
  await Bun.$`mkdir -p ${dirname(destination)}`
  await Bun.write(destination, Bun.file(source))
}

export const fail = (message: string): never => {
  console.error(`Error: ${message}`)
  process.exit(1)
}

export const run = async (
  command: string[],
  options: {
    cwd?: string
    env?: Record<string, string | undefined>
  } = {},
) => {
  const subprocess = Bun.spawn(command, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })

  const exitCode = await subprocess.exited
  if (exitCode !== 0) {
    fail(`Command failed with exit code ${exitCode}: ${command.join(' ')}`)
  }
}

export const commandExists = async (command: string) => {
  const subprocess = Bun.spawn(['/bin/sh', '-lc', `command -v ${command}`], {
    stdout: 'ignore',
    stderr: 'ignore',
  })

  return (await subprocess.exited) === 0
}
