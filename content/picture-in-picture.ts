const styleId = '_nou_pip'
const ancestorClass = '_nou_pip_ancestor'
let transition = 0
let outerDimensions: Map<string, PropertyDescriptor | undefined> | undefined

// YouTube uses outer window area to detect background playback on Android.
// Keep that measurement stable during native PiP; innerWidth/innerHeight still
// describe the real viewport and size the video to the floating window.
export function preparePictureInPicture() {
  if (window.NouTubePip) return
  outerDimensions = new Map()
  for (const key of ['outerWidth', 'outerHeight'] as const) {
    outerDimensions.set(key, Object.getOwnPropertyDescriptor(window, key))
    const value = Math.max(window[key], key === 'outerWidth' ? screen.width : screen.height)
    Object.defineProperty(window, key, { configurable: true, get: () => value })
  }
  window.NouTubePip = true
}

export async function setPictureInPicture(active: boolean) {
  const currentTransition = ++transition
  if (!active) {
    const wasPlaying = !document.querySelector('video')?.paused
    window.NouTubePip = false
    document.getElementById(styleId)?.remove()
    document.querySelectorAll('.' + ancestorClass).forEach((element) => element.classList.remove(ancestorClass))
    // Android reports PiP exit before the expansion animation has finished.
    // Restore the outer measurements after the full-size viewport settles.
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (currentTransition !== transition) return
    for (const [key, descriptor] of outerDimensions || []) {
      if (descriptor) Object.defineProperty(window, key, descriptor)
      else Reflect.deleteProperty(window, key)
    }
    outerDimensions = undefined
    window.dispatchEvent(new Event('resize'))
    if (wasPlaying) window.NouTube.play()
    return
  }

  preparePictureInPicture()
  if (document.fullscreenElement) await document.exitFullscreen()
  if (!window.NouTubePip) return
  document.getElementById(styleId)?.remove()
  const video = document.querySelector('video')
  for (let parent = video?.parentElement; parent; parent = parent.parentElement) {
    parent.classList.add(ancestorClass)
  }
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    body *:not(._nou_pip_ancestor):not(video) { display: none !important; }
    ._nou_pip_ancestor {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      transform: none !important;
      overflow: visible !important;
    }
    html, body { background: black !important; }
    video {
      visibility: visible !important;
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      object-fit: contain !important;
      transform: none !important;
      z-index: 2147483647 !important;
    }
  `
  document.head.appendChild(style)
  window.dispatchEvent(new Event('resize'))
  window.NouTube.play()
}

const bridgeToken = () => window.NouTubeToken || ''
let reported = ''

// The native side enters Picture-in-Picture from onUserLeaveHint, which cannot
// wait for an answer from the page (the activity has paused by the time one
// arrives), so hand it the video it would show ahead of time instead. A zero
// size means there is nothing to show and PiP stays disarmed.
function reportPictureInPictureVideo() {
  const video = document.querySelector('video')
  const onVideoPage = !!document.fullscreenElement || document.location.pathname == '/watch'
  const showable = onVideoPage && video && !video.paused && !video.ended && video.videoWidth > 0
  const size = showable ? [video.videoWidth, video.videoHeight] : [0, 0]
  const key = size.join('x')
  if (key == reported) {
    return
  }
  reported = key
  window.NouTubeI?.setPictureInPictureVideo?.(bridgeToken(), size[0], size[1])
}

export function watchPictureInPictureVideo() {
  if (!window.isAndroid || !window.NouTubeI?.setPictureInPictureVideo) {
    return
  }

  // Media events do not bubble, and YouTube swaps the video element around, so
  // listen for them on the way down instead of binding to one element.
  for (const type of ['play', 'playing', 'pause', 'ended', 'emptied', 'loadedmetadata', 'resize']) {
    document.addEventListener(type, reportPictureInPictureVideo, true)
  }
  for (const type of ['yt-navigate-finish', 'fullscreenchange', 'popstate']) {
    window.addEventListener(type, reportPictureInPictureVideo)
  }
  reportPictureInPictureVideo()
}
