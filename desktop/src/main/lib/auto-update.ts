import electronUpdater, { type AppUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { uiClient } from 'main/ipc/ui'

// Auto-update is available for the regular installers. 'portable' builds
// (flatpak, portable archives) are updated through their own channels, so the
// updater is disabled for them and the manual "check for updates" UI is hidden.
export const isUpdateSupported = import.meta.env.VITE_BUILD_TARGET != 'portable' && process.env.SNAP === undefined

export type UpdateCheckResult =
  | { status: 'not-available' }
  | { status: 'available'; version: string }
  | { status: 'error'; message: string }

function getAutoUpdater(): AppUpdater {
  // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
  // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

// Silent check on startup; surfaces a native notification once a build is downloaded.
export async function checkForUpdateOnStart() {
  if (is.dev || !isUpdateSupported) {
    return
  }
  const autoUpdater = getAutoUpdater()
  try {
    await autoUpdater.checkForUpdatesAndNotify()
  } catch (e) {
    console.error(e)
  }
}

// Manual check triggered from settings. Resolves as soon as the availability is
// known; when an update is available it keeps downloading in the background and
// prompts the renderer to restart once the download finishes.
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (is.dev || !isUpdateSupported) {
    return { status: 'not-available' }
  }
  const autoUpdater = getAutoUpdater()
  autoUpdater.removeAllListeners()

  autoUpdater.once('update-downloaded', (info) => {
    autoUpdater.removeAllListeners()
    void uiClient.updateDownloaded(info.version)
  })

  return new Promise<UpdateCheckResult>((resolve) => {
    const fail = (e: unknown) => {
      autoUpdater.removeAllListeners()
      resolve({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
    autoUpdater.once('update-not-available', () => {
      autoUpdater.removeAllListeners()
      resolve({ status: 'not-available' })
    })
    autoUpdater.once('update-available', (info) => {
      // Keep the 'update-downloaded' listener; download proceeds via autoDownload.
      resolve({ status: 'available', version: info.version })
    })
    autoUpdater.once('error', fail)
    autoUpdater.checkForUpdates().catch(fail)
  })
}

export function quitAndInstall() {
  getAutoUpdater().quitAndInstall()
}
