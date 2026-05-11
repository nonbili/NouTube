// Force YouTube to serve H.264 by claiming we cannot play VP8/VP9/AV1/WebM.
// Adapted from https://github.com/erkserkserks/h264ify (MIT).
const DISALLOWED = ['webm', 'vp8', 'vp9', 'av01']

function makeChecker(orig: (type: string) => any) {
  return function (type: string) {
    if (type === undefined) return ''
    for (const bad of DISALLOWED) {
      if (type.indexOf(bad) !== -1) return ''
    }
    return orig(type)
  }
}

export function installH264ify() {
  try {
    const videoElem = document.createElement('video')
    const origCanPlayType = videoElem.canPlayType.bind(videoElem)
    ;(HTMLVideoElement.prototype as any).canPlayType = makeChecker(origCanPlayType)
  } catch (e) {}

  try {
    const mse: any = (window as any).MediaSource
    if (mse && typeof mse.isTypeSupported === 'function') {
      const origIsTypeSupported = mse.isTypeSupported.bind(mse)
      mse.isTypeSupported = makeChecker(origIsTypeSupported)
    }
  } catch (e) {}
}
