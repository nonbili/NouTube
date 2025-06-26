export function emit(payload: Record<string, any>) {
  NouTubeI.onMessage(JSON.stringify(payload))
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
