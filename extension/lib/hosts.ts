/* Kept in sync with the `host_permissions` in wxt.config.ts. */
export const YOUTUBE_MATCHES = ['https://www.youtube.com/*', 'https://m.youtube.com/*', 'https://music.youtube.com/*']

/*
 * The embedded player. Only www serves it, and it is the one YouTube document
 * the content bundle also boots in when it is somebody else's iframe.
 * youtube-nocookie.com is the same player in privacy-enhanced mode; it is a
 * host of its own, and it too has to be in the `host_permissions`.
 */
export const YOUTUBE_EMBED_MATCHES = ['https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*']

const YOUTUBE_EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com']

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

export const isYouTubeEmbed = (url?: string) => {
  if (!url) {
    return false
  }
  try {
    const { host, pathname } = new URL(url)
    return YOUTUBE_EMBED_HOSTS.includes(host) && pathname.startsWith('/embed/')
  } catch {
    return false
  }
}
