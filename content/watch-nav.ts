function isWatch(href: string): boolean {
  try {
    return new URL(href, location.href).pathname.startsWith('/watch')
  } catch {
    return false
  }
}

function isEnabled(): boolean {
  return Boolean(window.NouTube?.getSettings?.()?.replaceWatchNavigation)
}

function resolveHistoryUrl(url: unknown): string {
  if (typeof url === 'string' && url) {
    try {
      return new URL(url, location.href).href
    } catch {
      return location.href
    }
  }
  return location.href
}

// When navigating from one /watch page to another /watch page, replace the
// history entry instead of pushing a new one, so the back button returns to the
// previous non-watch page instead of stepping through every visited video.
export function installWatchNavigation() {
  const root = window as Window & typeof globalThis & { __noutubeWatchNavInit?: boolean }
  if (root.__noutubeWatchNavInit) {
    return
  }
  root.__noutubeWatchNavInit = true

  const originalPushState = history.pushState
  history.pushState = function (this: History, ...args: any[]) {
    if (isEnabled() && isWatch(location.href) && isWatch(resolveHistoryUrl(args[2]))) {
      return history.replaceState.apply(this, args as any)
    }
    return originalPushState.apply(this, args as any)
  } as any
}
