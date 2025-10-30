export interface Segment {
  // https://wiki.sponsor.ajay.app/w/Types#Category
  category: string
  actionType: string
  segment: [number, number]
}

export function isSponsorBlockEnabled() {
  const value = localStorage.getItem('nou:settings')
  if (!value) {
    return false
  }
  try {
    const settings = JSON.parse(value)
    return settings.sponsorBlock
  } catch (e) {
    return false
  }
}

export async function getSkipSegments(videoId: string) {
  const res = await fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}`)
  let segments: Segment[] = []
  if (res.status == 200) {
    segments = (await res.json()) as Segment[]
  }
  return {
    videoId,
    segments,
  }
}
