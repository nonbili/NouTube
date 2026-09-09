export function emit(type: string, data?: any) {
  if (window.NouTubeI) {
    window.NouTubeI.onMessage(JSON.stringify({ type, data }))
  } else if (window.electron) {
    window.electron.ipcRenderer.sendToHost(type, data)
  }
}

export function log(...data: any[]) {
  console.log(...data)
  emit('[content]', data.length > 1 ? { data: [...data] } : data[0])
}

export function parseJson(v: string | null, fallback: any) {
  if (!v) {
    return fallback
  }
  try {
    return JSON.parse(v)
  } catch (e) {
    return fallback
  }
}

// Trusted Types is Chromium-only, so WebKit (the iOS webview, Safari) has no
// window.trustedTypes at all. It is only ever used to satisfy the policy the
// page enforces, and the createHTML below is the identity function, so falling
// back to it directly is equivalent everywhere it is missing.
export const nouPolicy = window.trustedTypes
  ? window.trustedTypes.createPolicy('nouPolicy', {
      createHTML: (x: string) => x,
    })
  : { createHTML: (x: string) => x }

export const isYTMusic = document.location.host == 'music.youtube.com'
