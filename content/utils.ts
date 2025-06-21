export function emit(payload: Record<string, any>) {
  NouTubeI.onMessage(JSON.stringify(payload))
}
