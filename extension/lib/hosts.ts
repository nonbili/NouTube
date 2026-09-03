/* Kept in sync with the `host_permissions` in wxt.config.ts. */
export const YOUTUBE_MATCHES = ['https://www.youtube.com/*', 'https://m.youtube.com/*', 'https://music.youtube.com/*']

const YOUTUBE_HOSTS = ['www.youtube.com', 'm.youtube.com', 'music.youtube.com']

export const isYouTube = (url?: string) => {
  if (!url) {
    return false
  }
  try {
    return YOUTUBE_HOSTS.includes(new URL(url).host)
  } catch {
    return false
  }
}
