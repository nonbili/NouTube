import { ui$ } from '@/states/ui'
import { tabs$ } from '@/states/tabs'
import type { ShortcutAction } from '@/lib/desktop-shortcuts'

/* Run a shortcut caught by the main process (see main/lib/shortcuts.ts). */
export function runShortcut(action: ShortcutAction, index?: number): void {
  switch (action) {
    case 'newTab':
      tabs$.openTab()
      break
    case 'reopenClosedTab': {
      const history = tabs$.recentlyClosedTabs.get()
      if (history.length) {
        tabs$.reopenClosedTab(history[0].id)
      }
      break
    }
    case 'closeTab':
      tabs$.closeTab()
      break
    case 'selectTab':
      if (index !== undefined && index < tabs$.tabs.length) {
        tabs$.setActiveTabIndex(index)
      }
      break
    case 'library':
      ui$.libraryModalOpen.toggle()
      break
    case 'history':
      ui$.historyModalOpen.toggle()
      break
    case 'openUrl':
      ui$.urlModalOpen.set(true)
      break
    case 'download': {
      const pageUrl = ui$.pageUrl.get()
      if (pageUrl) ui$.toolsModalUrl.set(pageUrl)
      break
    }
    case 'settings':
      ui$.settingsModalOpen.toggle()
      break
    case 'shortcuts':
      ui$.shortcutsModalOpen.toggle()
      break
  }
}
