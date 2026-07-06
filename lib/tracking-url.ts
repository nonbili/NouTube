const trackingParams = ['pp', 'si']

export function removeTrackingParams(v: string) {
  try {
    const url = new URL(v)
    trackingParams.forEach((param) => url.searchParams.delete(param))
    return url.href
  } catch {
    return v
  }
}
