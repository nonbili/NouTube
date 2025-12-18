const chromeVersion = 142

export function getUserAgent(platform = 'android') {
  const mobile = platform == 'android' ? 'Mobile ' : ''
  const detail =
    {
      darwin: 'Macintosh; Intel Mac OS X 10_15_7',
      linux: 'X11; Linux x86_64',
      android: 'Linux; Android 10; K',
    }[platform] || 'Windows NT 10.0; Win64; x64'
  return `Mozilla/5.0 (${detail}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 ${mobile}Safari/537.36`
}
