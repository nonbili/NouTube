const keys = ['adBreakHeartbeatParams', 'adPlacements', 'adSlots', 'playerAds']

export function transformPlayerResponse(text: string) {
  const data = JSON.parse(text)
  keys.forEach((key) => delete data[key])
  return JSON.stringify(data)
}
