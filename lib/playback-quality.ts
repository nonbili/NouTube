export const playbackQualities = [
  { value: 'auto', label: 'Auto' },
  { value: 'hd2160', label: '2160p (4K)' },
  { value: 'hd1440', label: '1440p' },
  { value: 'hd1080', label: '1080p' },
  { value: 'hd720', label: '720p' },
  { value: 'large', label: '480p' },
  { value: 'medium', label: '360p' },
  { value: 'small', label: '240p' },
  { value: 'tiny', label: '144p' },
] as const

export type PlaybackQualityValue = typeof playbackQualities[number]['value']

export function formatPlaybackQuality(value: string) {
  const quality = playbackQualities.find((q) => q.value === value)
  return quality ? quality.label : 'Auto'
}
