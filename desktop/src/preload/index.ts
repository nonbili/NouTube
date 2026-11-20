import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { getMouseHistoryDirection } from 'noutube/lib/desktop-shortcuts'
import { EDITING_CHANNEL, NAVIGATE_CHANNEL } from '../main/ipc/constants'

// Custom APIs for renderer
// const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  // window.api = api
}

// Tell the main process whether a text field has focus, so shortcuts that
// clash with text editing (Ctrl+B...) are left to the field.
if (process.isMainFrame) {
  const isEditable = (el: Element | null) => {
    const tag = el?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement | null)?.isContentEditable === true
  }
  // A new page starts with nothing focused; reset what the previous page left.
  let editing = false
  ipcRenderer.send(EDITING_CHANNEL, false)
  const report = () => {
    // Focus inside an iframe is reported on the iframe element; treat it as not editing.
    const next = isEditable(document.activeElement)
    if (next !== editing) {
      editing = next
      ipcRenderer.send(EDITING_CHANNEL, next)
    }
  }
  window.addEventListener('focusin', report, true)
  window.addEventListener('focusout', () => setTimeout(report, 0), true)
}

// Mouse Back/Forward buttons: browsers navigate on them, Electron does not.
// Ask the main process to navigate the active tab, like the header buttons.
if (process.isMainFrame) {
  window.addEventListener(
    'mouseup',
    (event) => {
      const direction = getMouseHistoryDirection(event.button)
      if (direction) {
        event.preventDefault()
        ipcRenderer.send(NAVIGATE_CHANNEL, direction)
      }
    },
    true,
  )
}
