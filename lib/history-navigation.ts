import { handleSplitBack } from './split-view'
import type { HistoryDirection } from './desktop-shortcuts'

/* Back/forward in `webview`, shared by the header buttons and the desktop mouse buttons. */
export function navigateHistory(webview: any, direction: HistoryDirection) {
  if (direction === 'back' && handleSplitBack()) {
    return
  }
  try {
    if (direction === 'back') {
      if (typeof webview?.goBack === 'function') {
        webview.goBack()
      } else {
        webview?.executeJavaScript?.('history.back()')
      }
    } else if (typeof webview?.goForward === 'function') {
      webview.goForward()
    } else {
      webview?.executeJavaScript?.('history.forward()')
    }
  } catch {
    // webview not dom-ready yet; goBack/goForward throw until then
  }
}
