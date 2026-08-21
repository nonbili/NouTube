import { log } from './utils'

// YouTube stops background playback on purpose: mobile web pauses for
// non-premium users when it believes the page is hidden, and inactivity
// prompts ("Video paused. Continue watching?", ytmusic-you-there-renderer)
// pause after a few hours. The WebView reports itself as always visible, so
// the page can't tell it is backgrounded — but the native side can, and it
// mirrors the real app visibility into window.NouTubeBackground
// (NouTubeView.onWindowVisibilityChanged).
//
// While the app is in the background the user cannot reach the page, so a
// pause that was not commanded through NouTube.pause() (media notification,
// bluetooth, sleep timer) and is not an audio interruption (call, another
// app playing — NouTubeI.canAutoResume) can only come from YouTube itself:
// dismiss the prompt if one is shown and resume.

const PLAYING = 1
const PAUSED = 2

const bridgeToken = () => window.NouTubeToken || ''

let appPaused = false
let wasPlaying = false
let pausedByInterruption = false
let pausedTicks = 0
let resumeAttempts = 0

const isBackground = () => window.NouTubeBackground === true

function confirmYouThereDialogs() {
  // "Continue watching?" prompts. Only click when the dialog has exactly one
  // button, so a wrong guess is impossible; with more buttons playVideo()
  // below resumes playback just as well and YouTube drops the prompt itself.
  for (const selector of ['ytmusic-you-there-renderer', 'ytm-confirm-dialog-renderer']) {
    const dialog = document.querySelector(selector)
    if (!dialog) {
      continue
    }
    const buttons = dialog.querySelectorAll('button')
    if (buttons.length === 1) {
      ;(buttons[0] as HTMLElement).click()
      return true
    }
    // A dialog left in the DOM but not clickable must not hide the next one.
  }
  return false
}

export function installBackgroundGuard() {
  // Track pauses the app itself asked for (media notification, bluetooth,
  // sleep timer): those episodes are never fought, however long they last.
  const nouTube = window.NouTube as any
  if (nouTube && !nouTube.__nouGuardedPause) {
    const originalPause = nouTube.pause.bind(nouTube)
    const originalPlay = nouTube.play.bind(nouTube)
    nouTube.pause = () => {
      appPaused = true
      return originalPause()
    }
    nouTube.play = () => {
      appPaused = false
      return originalPlay()
    }
    nouTube.__nouGuardedPause = true
  }

  // A pause from YouTube's own controls bypasses NouTube.pause(). Record it
  // synchronously while the app is visible so immediately backgrounding the
  // app cannot race the polling loop below and restart user-paused playback.
  document.addEventListener(
    'pause',
    (event) => {
      const player = document.getElementById('movie_player')
      if (!isBackground() && event.target instanceof Node && player?.contains(event.target)) {
        appPaused = true
      }
    },
    true,
  )

  // Playback that starts right before the app is backgrounded would otherwise
  // not be seen by the poll below at all, and a YouTube pause in that window
  // would look like a video that was never playing.
  for (const type of ['play', 'playing']) {
    document.addEventListener(
      type,
      (event) => {
        const player = document.getElementById('movie_player')
        if (event.target instanceof Node && player?.contains(event.target)) {
          appPaused = false
          wasPlaying = true
        }
      },
      true,
    )
  }

  setInterval(() => {
    const player = document.getElementById('movie_player') as any
    if (!player?.getPlayerState) {
      return
    }

    const state = player.getPlayerState()
    if (state === PLAYING) {
      appPaused = false
      wasPlaying = true
      pausedByInterruption = false
      pausedTicks = 0
      resumeAttempts = 0
      return
    }

    if (!isBackground()) {
      // The user can interact with the page again; whatever is paused now is
      // their business.
      wasPlaying = false
      pausedByInterruption = false
      pausedTicks = 0
      resumeAttempts = 0
      return
    }

    if (state !== PAUSED || !wasPlaying || appPaused || pausedByInterruption) {
      return
    }
    pausedTicks++
    if (resumeAttempts >= 3) {
      return
    }
    if (window.NouTubeI?.canAutoResume?.(bridgeToken()) === false) {
      // Our own stream lingers as "active" for ~10s after a pause, so give it
      // a few ticks to clear. Still blocked after that means a call or another
      // app really took the audio over: stay paused for good — if the
      // interruption ends, the user resumes from the media notification, not us.
      if (pausedTicks >= 6) {
        pausedByInterruption = true
      }
      return
    }

    resumeAttempts++
    const dismissed = confirmYouThereDialogs()
    log(`background guard: resuming (attempt ${resumeAttempts}, dialog: ${dismissed})`)
    player.playVideo?.()
  }, 5000)
}
