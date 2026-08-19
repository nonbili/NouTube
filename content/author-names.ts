/*
 * The mobile site sometimes renders the channel name percent-encoded
 * (`%E4%BD%A0%E5%A5%BD` instead of the actual name). The player response carries
 * the decoded name, so swap it in. The `%XX` test means this turns itself off
 * without a trace if YouTube ever stops emitting the encoded form.
 */
const fixEncodedAuthorNames = () => {
  if (location.pathname !== '/watch') {
    return
  }

  const player = document.querySelector<any>('#movie_player')
  const author = player?.getPlayerResponse?.()?.videoDetails?.author
  if (!author) {
    return
  }

  document
    .querySelectorAll(
      'ytm-slim-video-information-renderer .slim-video-information-channel-name .ytAttributedStringHost, ' +
        'ytm-slim-owner-renderer .ytAttributedStringHost',
    )
    .forEach((label) => {
      if (!/%[0-9a-f]{2}/i.test(label.textContent || '')) {
        return
      }

      const parts = label.querySelectorAll(':scope > span')
      const name = parts.length > 1 && parts[0].textContent === '@' ? parts[parts.length - 1] : label
      const text = name === label ? '@' + author : author
      if (name.textContent !== text) {
        name.textContent = text
      }
    })
}

export function installEncodedAuthorNameFix() {
  // The selectors are mobile-site renderers, so this can never match elsewhere.
  if (location.host !== 'm.youtube.com') {
    return
  }

  new MutationObserver(fixEncodedAuthorNames).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  fixEncodedAuthorNames()
}
