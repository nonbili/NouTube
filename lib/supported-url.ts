const SUPPORTED_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])

export function isSupportedUrl(value: string) {
  try {
    const url = new URL(value.replace('noutube://', 'https://'))
    return ['http:', 'https:'].includes(url.protocol) && SUPPORTED_HOSTS.has(url.host)
  } catch {
    return false
  }
}

export function normalizeSupportedUrl(value: string) {
  return value.replace('noutube://', 'https://')
}
