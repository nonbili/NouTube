const chromeVersion = 142

export function getUserAgent(platform = 'android', isDesktop = false) {
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
