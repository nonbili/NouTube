import { ui$ } from '@/states/ui'

const platform = window.electron.process.platform

export function handleShortcuts(event: KeyboardEvent) {
  if (platform == 'darwin') {
    if (!event.metaKey) {
      return
    }
  } else if (!event.ctrlKey) {
    return
  }
  switch (event.key) {
    case 'h':
      ui$.historyModalOpen.toggle()
      break
    case 'o':
      ui$.urlModalOpen.set(true)
      break
  }
}
