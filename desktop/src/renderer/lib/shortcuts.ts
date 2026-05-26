import { ui$ } from '@/states/ui'
import { tabs$ } from '@/states/tabs'

const platform = window.electron.process.platform

type ShortcutEvent = KeyboardEvent | (Electron.Input & { preventDefault?: () => void })

export function handleShortcuts(event: ShortcutEvent): void {
  const metaPressed = ('metaKey' in event && event.metaKey) || ('meta' in event && event.meta)
  const ctrlPressed = ('ctrlKey' in event && event.ctrlKey) || ('control' in event && event.control)
  if (platform == 'darwin') {
    if (!metaPressed) {
      return
    }
  } else if (!ctrlPressed) {
    return
  }
  const key = event.key.toLowerCase()
  switch (key) {
    case 't':
      event.preventDefault?.()
      if (('shiftKey' in event && event.shiftKey) || ('shift' in event && event.shift)) {
        const history = tabs$.recentlyClosedTabs.get()
        if (history.length) {
          tabs$.reopenClosedTab(history[0].id)
        }
      } else {
        tabs$.openTab()
      }
      break
    case 'w':
      event.preventDefault?.()
      tabs$.closeTab()
      break
    case 'h':
      ui$.historyModalOpen.toggle()
      break
    case 'o':
      ui$.urlModalOpen.set(true)
      break
    case 'd': {
      const pageUrl = ui$.pageUrl.get()
      if (pageUrl) ui$.toolsModalUrl.set(pageUrl)
      break
    }
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9': {
      const targetIndex = Number(key) - 1
      if (targetIndex < tabs$.tabs.length) {
        event.preventDefault?.()
        tabs$.setActiveTabIndex(targetIndex)
      }
      break
    }
  }
}
