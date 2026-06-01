import { app, shell, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setMainWindow } from './lib/main-window'
import { bindDeeplink } from './lib/deeplink'
import { genDesktopFile } from './lib/linux'
import { interceptHttpRequest } from './lib/intercept'
import { checkForUpdateOnStart } from './lib/auto-update'
import { initMainChannel } from './ipc/main'
import contextMenu from 'electron-context-menu'
import { getUserAgent } from '@/lib/useragent'
import { isSupportedUrl, normalizeSupportedUrl } from '@/lib/supported-url'
import { uiClient } from './ipc/ui'

app.userAgentFallback = getUserAgent(process.platform)

// YouTube wraps external links as /redirect?q=<target>; unwrap to the real target.
function resolveTargetUrl(rawUrl: string): string {
  try {
    const { pathname, searchParams } = new URL(rawUrl)
    const redirectTo = searchParams.get('q')
    return pathname === '/redirect' && redirectTo ? redirectTo : rawUrl
  } catch {
    return rawUrl
  }
}

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: Math.floor(width * 0.9),
    height: Math.floor(height * 0.9),
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
    },
  })
  setMainWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.disposition === 'picture-in-picture') {
      return { action: 'allow' }
    }
    if (isSupportedUrl(details.url)) {
      void uiClient.openInAppTab(normalizeSupportedUrl(details.url))
    } else {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.webContents.on('will-attach-webview', (_, webPreferences) => {
    webPreferences.sandbox = false
    webPreferences.preload = join(__dirname, '../preload/index.js')
  })

  const getContextMenuOptions = (
    wc: Electron.WebContents,
  ): {
    showCopyImage: boolean
    showLearnSpelling: boolean
    showLookUpSelection: boolean
    showSearchWithGoogle: boolean
    showSelectAll: boolean
    prepend: (_defaultActions: unknown, params: Electron.ContextMenuParams) => Electron.MenuItemConstructorOptions[]
  } => ({
    showCopyImage: false,
    showLearnSpelling: false,
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showSelectAll: false,
    prepend: (_defaultActions: unknown, params: Electron.ContextMenuParams): Electron.MenuItemConstructorOptions[] => {
      const url = resolveTargetUrl(params.linkURL)
      return [
        {
          label: 'Open Link in New Tab',
          visible: Boolean(params.linkURL) && isSupportedUrl(url),
          click: () => {
            void uiClient.openInAppTab(normalizeSupportedUrl(url))
          },
        },
        {
          label: 'Star',
          visible: Boolean(params.linkURL) && isSupportedUrl(url),
          click: () => {
            void uiClient.star(normalizeSupportedUrl(url), params.linkText)
          },
        },
        {
          label: 'Picture-in-Picture',
          visible: params.mediaType === 'video',
          click: () => {
            wc.executeJavaScript(
              `(() => {
                const video = document.querySelector('video');
                if (video) {
                  if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().catch(console.error);
                  } else {
                    video.requestPictureInPicture().catch(console.error);
                  }
                }
              })()`,
              true,
            ).catch(console.error)
          },
        },
      ]
    },
  })
  // @ts-expect-error electron-context-menu types mismatch
  contextMenu.default({ ...getContextMenuOptions(mainWindow.webContents), window: mainWindow.webContents })
  mainWindow.webContents.on('did-attach-webview', (e, wc) => {
    // @ts-expect-error electron-context-menu types mismatch
    contextMenu.default({ ...getContextMenuOptions(wc), window: wc })
    wc.setWindowOpenHandler((details) => {
      if (details.disposition === 'picture-in-picture') {
        return { action: 'allow' }
      }
      const url = resolveTargetUrl(details.url)
      if (isSupportedUrl(url)) {
        void uiClient.openInAppTab(normalizeSupportedUrl(url))
      } else {
        shell.openExternal(url)
      }
      return { action: 'deny' }
    })
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  interceptHttpRequest()

  initMainChannel()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (import.meta.env.VITE_BUILD_TARGET != 'portable') {
    genDesktopFile()
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

bindDeeplink()

checkForUpdateOnStart()
