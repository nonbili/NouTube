/* Only regular YouTube watch pages belong in the separate player. */
export function isWatchUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.host) &&
      url.pathname === '/watch'
    )
  } catch {
    return false
  }
}
