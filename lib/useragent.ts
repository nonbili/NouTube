const chromeVersion = 150
const safariVersion = '17.6'

// WebKit only keeps a YouTube stream alive past its first minute when YouTube
// serves the one it picks for Safari: asking as Chrome gets a stream the player
// stalls on at ~60s, dropping back to UNSTARTED with nothing able to restart it
// (and taking Picture-in-Picture down with it). So iOS always asks as Safari.
function getIosUserAgent(isDesktop: boolean) {
  return isDesktop
    ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Safari/605.1.15`
    : `Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Mobile/15E148 Safari/604.1`
}

export function getUserAgent(platform = 'android', isDesktop = false) {
  if (platform == 'ios') {
    return getIosUserAgent(isDesktop)
  }
  const mobile = platform == 'android' && !isDesktop ? 'Mobile ' : ''
  const effectivePlatform = platform == 'android' && isDesktop ? 'linux' : platform
  const detail =
    {
      darwin: 'Macintosh; Intel Mac OS X 10_15_7',
      linux: 'X11; Linux x86_64',
      android: 'Linux; Android 10; K',
    }[effectivePlatform] || 'Windows NT 10.0; Win64; x64'
  return `Mozilla/5.0 (${detail}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 ${mobile}Safari/537.36`
}

export function resolveUserAgent(platform = 'android', customUserAgent = '', isDesktop = false) {
  const override = customUserAgent.trim()
  return override || getUserAgent(platform, isDesktop)
}
