export function emit(type: string, data?: any) {
  NouTubeI.onMessage(JSON.stringify({ type, data }))
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

export const nouPolicy = trustedTypes.createPolicy('nouPolicy', {
  createHTML: (x: string) => x,
})
