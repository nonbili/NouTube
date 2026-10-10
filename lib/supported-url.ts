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

/* youtu.be only redirects to the watch page. Nothing that decides where a link
 * belongs recognises it as a video until it has been spelled out. */
export function expandShortUrl(value: string) {
  try {
    const url = new URL(value)
    const id = url.host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : ''
    if (!id) {
      return value
    }
    const watch = new URL('https://www.youtube.com/watch')
    watch.searchParams.set('v', id)
    // The start time and the playlist ride along on the share link.
    url.searchParams.forEach((param, key) => {
      if (key !== 'v') {
        watch.searchParams.set(key, param)
      }
    })
    return watch.href
  } catch {
    return value
  }
}
