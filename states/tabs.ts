import { observable, syncState, type Observable, when } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId } from '@/lib/utils'
import { settings$ } from './settings'

export interface Tab {
  id: string
  url: string
  pageUrl: string
  title?: string
  icon?: string
  isLoading?: boolean
  canGoBack?: boolean
}

export interface ClosedTab extends Tab {
  closedAt: number
}

interface Store {
  tabs: Tab[]
  activeTabIndex: number
  recentlyClosedTabs: ClosedTab[]

  currentTab: () => Tab | undefined
  activePageUrl: () => string
  openTab: (url?: string) => string
  duplicateTab: (index?: number) => string | undefined
  closeTab: (index?: number) => void
  reopenClosedTab: (tabId: string) => string | undefined
  updateTabUrl: (url: string, index?: number) => void
  setTabPageUrl: (url: string, index?: number) => void
  setTabLoading: (loading: boolean, index?: number) => void
  setTabCanGoBack: (canGoBack: boolean, index?: number) => void
  setTabMeta: (meta: Pick<Partial<Tab>, 'title' | 'icon'>, index?: number) => void
  setActiveTabIndex: (index: number) => void
}

const MAX_RECENTLY_CLOSED_TABS = 10
let startupTabsInitialized = false

export function getDefaultTabUrl() {
  return settings$.home.get() === 'yt-music' ? 'https://music.youtube.com/' : 'https://www.youtube.com/'
}

function normalizeTabs(data: Partial<Store> | undefined) {
  if (!data) {
    return data
  }
  const seenIds = new Set<string>()
  data.tabs = (data.tabs || [])
    .filter((tab): tab is Tab => tab != null)
    .map((tab) => {
      if (!tab.id || seenIds.has(tab.id)) {
        tab.id = genId()
      }
      seenIds.add(tab.id)
      tab.url = tab.url || getDefaultTabUrl()
      tab.pageUrl = tab.pageUrl || tab.url
      tab.isLoading = false
      tab.canGoBack = false
      return tab
    })
  if (!data.tabs.length) {
    data.tabs = [newTab(getDefaultTabUrl())]
  }
  if (typeof data.activeTabIndex !== 'number' || data.activeTabIndex < 0) {
    data.activeTabIndex = 0
  }
  if (data.activeTabIndex >= data.tabs.length) {
    data.activeTabIndex = data.tabs.length - 1
  }
  data.recentlyClosedTabs = (data.recentlyClosedTabs || [])
    .filter((tab): tab is ClosedTab => tab != null && typeof tab.url === 'string')
    .map((tab) => ({
      ...tab,
      id: tab.id || genId(),
      closedAt: typeof tab.closedAt === 'number' ? tab.closedAt : Date.now(),
      isLoading: false,
      canGoBack: false,
    }))
    .slice(0, MAX_RECENTLY_CLOSED_TABS)
  return data
}

function newTab(url = getDefaultTabUrl()): Tab {
  return {
    id: genId(),
    url,
    pageUrl: url,
    isLoading: Boolean(url),
    canGoBack: false,
  }
}

function getTargetIndex(index?: number) {
  return index ?? tabs$.activeTabIndex.get()
}

function updateHomeFromUrl(url: string) {
  try {
    const { host } = new URL(url)
    settings$.home.set(host === 'music.youtube.com' ? 'yt-music' : 'yt')
  } catch {}
}

function pushRecentlyClosedTab(tab: Tab | undefined) {
  if (!tab?.url) {
    return
  }
  const history = tabs$.recentlyClosedTabs.get()
  tabs$.recentlyClosedTabs.set([{ ...tab, closedAt: Date.now(), isLoading: false }, ...history].slice(0, MAX_RECENTLY_CLOSED_TABS))
}

export const tabs$: Observable<Store> = observable<Store>({
  tabs: [newTab()],
  activeTabIndex: 0,
  recentlyClosedTabs: [],

  currentTab: () => tabs$.tabs[tabs$.activeTabIndex.get()]?.get(),
  activePageUrl: () => {
    const tab = tabs$.tabs[tabs$.activeTabIndex.get()]?.get()
    return tab?.pageUrl || tab?.url || ''
  },

  openTab: (url = getDefaultTabUrl()) => {
    const tab = newTab(url)
    tabs$.tabs.push(tab)
    tabs$.activeTabIndex.set(tabs$.tabs.length - 1)
    return tab.id
  },

  duplicateTab: (index) => {
    const targetIndex = getTargetIndex(index)
    const sourceTab = tabs$.tabs.get()[targetIndex]
    if (!sourceTab) {
      return undefined
    }
    const url = sourceTab.pageUrl || sourceTab.url
    const tab = newTab(url)
    tabs$.tabs.splice(targetIndex + 1, 0, tab)
    tabs$.activeTabIndex.set(targetIndex + 1)
    return tab.id
  },

  closeTab: (index) => {
    const tabs = tabs$.tabs.get()
    const targetIndex = getTargetIndex(index)
    const closedTab = tabs[targetIndex]
    if (!closedTab) {
      return
    }

    pushRecentlyClosedTab(closedTab)
    tabs$.tabs.splice(targetIndex, 1)

    const nextTabs = tabs$.tabs.get()
    if (!nextTabs.length) {
      tabs$.tabs.set([newTab(getDefaultTabUrl())])
      tabs$.activeTabIndex.set(0)
      return
    }

    const activeIndex = tabs$.activeTabIndex.get()
    if (targetIndex < activeIndex) {
      tabs$.activeTabIndex.set(activeIndex - 1)
    } else if (targetIndex === activeIndex) {
      tabs$.activeTabIndex.set(Math.min(targetIndex, nextTabs.length - 1))
    }
  },

  reopenClosedTab: (tabId) => {
    const history = tabs$.recentlyClosedTabs.get()
    const tab = history.find((item) => item.id === tabId)
    if (!tab) {
      return undefined
    }
    tabs$.recentlyClosedTabs.set(history.filter((item) => item.id !== tabId))
    const reopened = {
      ...tab,
      id: genId(),
      isLoading: Boolean(tab.url),
      canGoBack: false,
      closedAt: undefined,
    }
    delete (reopened as Partial<ClosedTab>).closedAt
    tabs$.tabs.push(reopened as Tab)
    tabs$.activeTabIndex.set(tabs$.tabs.length - 1)
    return reopened.id
  },

  updateTabUrl: (url, index) => {
    const targetIndex = getTargetIndex(index)
    const tab$ = tabs$.tabs[targetIndex]
    if (!tab$?.get()) {
      tabs$.openTab(url)
      return
    }
    tab$.assign({
      url,
      pageUrl: url,
      title: undefined,
      icon: undefined,
      isLoading: Boolean(url),
      canGoBack: false,
    })
    updateHomeFromUrl(url)
  },

  setTabPageUrl: (url, index) => {
    if (!url || url === 'about:blank') {
      return
    }
    const targetIndex = getTargetIndex(index)
    const tab$ = tabs$.tabs[targetIndex]
    if (!tab$?.get()) {
      return
    }
    tab$.pageUrl.set(url)
    updateHomeFromUrl(url)
  },

  setTabLoading: (loading, index) => {
    const tab$ = tabs$.tabs[getTargetIndex(index)]
    if (tab$?.get()) {
      tab$.isLoading.set(loading)
    }
  },

  setTabCanGoBack: (canGoBack, index) => {
    const tab$ = tabs$.tabs[getTargetIndex(index)]
    if (tab$?.get()) {
      tab$.canGoBack.set(canGoBack)
    }
  },

  setTabMeta: (meta, index) => {
    const tab$ = tabs$.tabs[getTargetIndex(index)]
    if (tab$?.get()) {
      tab$.assign(meta)
    }
  },

  setActiveTabIndex: (index) => {
    const tabs = tabs$.tabs.get()
    if (index >= 0 && index < tabs.length) {
      tabs$.activeTabIndex.set(index)
    }
  },
})

syncObservable(tabs$, {
  persist: {
    name: 'tabs',
    plugin: ObservablePersistMMKV,
    transform: {
      load: normalizeTabs,
    },
  },
})

export async function initializeDesktopTabsForStartup() {
  if (startupTabsInitialized) {
    return
  }
  startupTabsInitialized = true

  await when(() => syncState(settings$).isPersistLoaded.get() && syncState(tabs$).isPersistLoaded.get())

  if (settings$.restoreOnStart.get()) {
    return
  }

  tabs$.tabs.set([newTab(getDefaultTabUrl())])
  tabs$.activeTabIndex.set(0)
  tabs$.recentlyClosedTabs.set([])
}
