import { isSupportedUrl } from '@/lib/supported-url'

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // HomeScreen handles the original Linking URL. Routing YouTube's path as an
  // app screen would remount its WebViews and discard the browsing page.
  return isSupportedUrl(path) ? '/' : path
}
