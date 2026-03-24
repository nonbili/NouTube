const MOBILE_RELEASES_FEED_URL = 'https://github.com/nonbili/NouTube/releases.atom'

export async function fetchReleaseFeed() {
  const res = await fetch(MOBILE_RELEASES_FEED_URL, {
    headers: {
      accept: 'application/atom+xml, text/xml;q=0.9, */*;q=0.8',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch changelog: ${res.status}`)
  }

  return res.text()
}
