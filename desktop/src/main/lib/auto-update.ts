import electronUpdater, { type AppUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { AppUpdaterEvents } from 'electron-updater/out/AppUpdater.js'
import path from 'path'
import { app } from 'electron'

function getAutoUpdater(): AppUpdater {
  // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
  // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

export async function checkForUpdate() {
  if (is.dev) {
    return
  }
  const autoUpdater = getAutoUpdater()
  autoUpdater.addListener('update-available', (info) => {
    console.log('update-available')
  })
  autoUpdater.addListener('update-not-available', (info) => {
    console.log('update-not-available')
  })
  autoUpdater.addListener('update-downloaded', (info) => {
    console.log('update-downloaded')
  })
  try {
    await autoUpdater.checkForUpdatesAndNotify()
  } catch (e) {
    console.error(e)
  } finally {
    autoUpdater.removeAllListeners()
  }
}
