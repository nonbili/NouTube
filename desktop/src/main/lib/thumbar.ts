import { BrowserWindow, nativeImage, nativeTheme, type NativeImage, type ThumbarButton } from 'electron'
import type { TaskbarControlLabels, TaskbarControlsState } from '@/lib/taskbar-controls'
import { uiClient } from '../ipc/ui'
import { renderThumbarIconBitmap, THUMBAR_ICON_SIZE, type ThumbarIconName } from './thumbar-icons'

type IconSet = Record<ThumbarIconName, NativeImage>

const DEFAULT_LABELS: TaskbarControlLabels = { previous: 'Previous', play: 'Play', pause: 'Pause', next: 'Next' }

const iconCache = new Map<string, IconSet>()
let targetWindow: BrowserWindow | undefined
let state: Required<TaskbarControlsState> = { enabled: false, playing: false, labels: DEFAULT_LABELS }

function createIcon(name: ThumbarIconName, dark: boolean, enabled: boolean): NativeImage {
  return nativeImage.createFromBitmap(renderThumbarIconBitmap(name, { dark, enabled }), {
    width: THUMBAR_ICON_SIZE,
    height: THUMBAR_ICON_SIZE,
  })
}

function getIconSet(dark: boolean, enabled: boolean): IconSet {
  const key = `${dark}:${enabled}`
  let cached = iconCache.get(key)
  if (!cached) {
    cached = {
      previous: createIcon('previous', dark, enabled),
      play: createIcon('play', dark, enabled),
      pause: createIcon('pause', dark, enabled),
      next: createIcon('next', dark, enabled),
    }
    iconCache.set(key, cached)
  }
  return cached
}

function apply(): void {
  if (process.platform !== 'win32' || !targetWindow || targetWindow.isDestroyed()) {
    return
  }

  // The thumbnail toolbar is drawn in the taskbar's (system) theme, which can
  // differ from the apps theme that shouldUseDarkColors follows.
  const icons = getIconSet(nativeTheme.shouldUseDarkColorsForSystemIntegratedUI, state.enabled)
  // Electron's Windows TaskbarHost rejects an 'enabled' flag (the docs list
  // it, the code does not), so enabled buttons pass no flags at all.
  const flags: string[] = state.enabled ? [] : ['disabled']
  const { labels } = state

  const buttons: ThumbarButton[] = [
    {
      tooltip: labels.previous,
      icon: icons.previous,
      flags,
      click: () => void uiClient.taskbarControl('previous'),
    },
    {
      tooltip: state.playing ? labels.pause : labels.play,
      icon: state.playing ? icons.pause : icons.play,
      flags,
      click: () => void uiClient.taskbarControl('play-pause'),
    },
    {
      tooltip: labels.next,
      icon: icons.next,
      flags,
      click: () => void uiClient.taskbarControl('next'),
    },
  ]

  targetWindow.setThumbarButtons(buttons)
}

export function initThumbar(window: BrowserWindow): void {
  if (process.platform !== 'win32') {
    return
  }
  targetWindow = window
  // Windows drops the buttons when the window is hidden and shown again.
  window.on('show', apply)
  nativeTheme.on('updated', apply)
  window.on('closed', () => {
    nativeTheme.removeListener('updated', apply)
    if (targetWindow === window) {
      targetWindow = undefined
    }
  })
}

export function setTaskbarControls(next: Partial<TaskbarControlsState>): void {
  if (process.platform !== 'win32') {
    return
  }
  const enabled = Boolean(next?.enabled)
  state = {
    enabled,
    playing: enabled && Boolean(next?.playing),
    labels: { ...DEFAULT_LABELS, ...next?.labels },
  }
  apply()
}
