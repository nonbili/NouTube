/* Android WebView never gives the page an idle period: requestIdleCallback only
 * runs once its timeout expires, even while the main thread has nothing to do.
 * YouTube's mobile site schedules loading its page UI -- header, title,
 * comments, recommendations -- that way, so the video plays on a black page
 * until YouTube's fallback timer fires, several seconds in. Run idle callbacks
 * on the next task instead, with the 50 ms budget an idle period would give
 * them, the way the page gets them in a browser. */
export function installIdleCallbackShim() {
  window.requestIdleCallback = (callback: IdleRequestCallback) => {
    const start = performance.now()
    return window.setTimeout(
      () =>
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
        }),
      1,
    )
  }
  window.cancelIdleCallback = (handle: number) => window.clearTimeout(handle)
}
