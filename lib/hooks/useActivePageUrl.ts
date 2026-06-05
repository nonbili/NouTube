import { useValue } from '@legendapp/state/react'
import { isWeb } from '@/lib/utils'
import { tabs$ } from '@/states/tabs'
import { ui$ } from '@/states/ui'

export function useActivePageUrl() {
  const pageUrl = useValue(ui$.pageUrl)
  const url = useValue(ui$.url)
  const tabs = useValue(tabs$.tabs)
  const activeTabIndex = useValue(tabs$.activeTabIndex)
  const activeTab = tabs[activeTabIndex]

  return isWeb ? activeTab?.pageUrl || activeTab?.url || pageUrl : pageUrl || url
}
