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

export const nouPolicy =
  typeof window !== 'undefined' && (window as any).trustedTypes
    ? (window as any).trustedTypes.createPolicy('nouPolicy', {
        createHTML: (x: string) => x,
      })
    : { createHTML: (x: string) => x }

export const isYTMusic = typeof document !== 'undefined' && document.location ? document.location.host == 'music.youtube.com' : false
