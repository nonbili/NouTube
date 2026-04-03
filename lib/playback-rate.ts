export const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]

export function formatPlaybackRate(rate: number) {
  return `${rate.toFixed(2).replace(/\.?0+$/, '')}x`
}
