/* A split player is a small viewport inside the app's full-size window.
 * Android WebView reports both sizes as the viewport size. YouTube interprets
 * the small outer-window/screen ratio as system PiP and pauses videos that
 * cannot play there. Keep the outer window at screen size; innerWidth and
 * innerHeight still describe the real viewport and drive the mini layout. */
export function installSplitPlayerWindow(target: Window = window) {
  Object.defineProperties(target, {
    outerWidth: { configurable: true, get: () => target.screen.width },
    outerHeight: { configurable: true, get: () => target.screen.height },
  })
}
