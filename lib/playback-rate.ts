export const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]

export function formatPlaybackRate(rate: number) {
  return `${rate.toFixed(2).replace(/\.?0+$/, '')}x`
}

// YouTube's own speed slider hands out rates that are not on the list above
// (1.15, say), and those persist like any other. Splicing the current one in
// keeps it visible and marked as selected instead of leaving every option
// looking unselected.
export function playbackRatesWith(rate: number) {
  if (!Number.isFinite(rate) || playbackRates.includes(rate)) {
    return playbackRates
  }
  return [...playbackRates, rate].sort((a, b) => a - b)
}
