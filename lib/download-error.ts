// yt-dlp's stderr is developer output — multi-line, prefixed, and mixed with warnings that have
// nothing to do with the failure. These map the failures users actually hit onto a message that
// says what happened. The raw text still goes to the console.
const ERROR_PATTERNS: [RegExp, string][] = [
  [/HTTP Error 403|403: Forbidden/i, 'modals.downloadErrorBlocked'],
  [
    /Sign in to confirm|not a bot|age-restricted|Private video|members-only|Join this channel/i,
    'modals.downloadErrorSignIn',
  ],
  [/Requested format is not available/i, 'modals.downloadErrorFormat'],
  [/Video unavailable|has been removed|is not available/i, 'modals.downloadErrorUnavailable'],
  [
    /Unable to (?:connect|resolve)|getaddrinfo|Network is unreachable|timed out|Connection reset/i,
    'modals.downloadErrorNetwork',
  ],
]

// The interesting line is the last ERROR one; yt-dlp puts warnings before it.
const errorDetail = (output: string) => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const errorLine = lines.filter((line) => line.startsWith('ERROR:')).pop()
  return (errorLine ?? lines.filter((line) => !line.startsWith('WARNING:')).pop() ?? '').replace(/^ERROR:\s*/, '')
}

export const describeDownloadError = (output: string): { messageKey?: string; detail: string } => {
  const detail = errorDetail(output)
  const matched = ERROR_PATTERNS.find(([pattern]) => pattern.test(detail || output))
  return { messageKey: matched?.[1], detail }
}
