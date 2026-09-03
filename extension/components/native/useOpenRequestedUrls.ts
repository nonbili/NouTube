import { useEffect } from 'react'
import { browser } from 'wxt/browser'
import { tabs$ } from '@/states/tabs'

/*
 * The app's items navigate by handing a URL to the tab store, which in the app
 * drives the embedded webview. Here there is no webview: anything that lands in
 * the store is a request to open that URL in a real browser tab.
 */
export function useOpenRequestedUrls() {
  useEffect(() => {
    const unsubscribe = tabs$.tabs.onChange(({ value }) => {
      const urls = (value || []).map((tab) => tab?.url).filter((url): url is string => Boolean(url))
      if (!urls.length) {
        return
      }
      tabs$.tabs.set([])
      tabs$.activeTabIndex.set(0)
      urls.forEach((url) => void browser.tabs.create({ url }))
    })
    return unsubscribe
  }, [])
}
