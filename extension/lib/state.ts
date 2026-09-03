/*
 * The page half of the content bundle takes the same settings object the app's
 * shells hand it — a projection of the app's SettingsSnapshot, minus everything
 * the shell itself provides.
 */
export interface ContentSettings {
  sponsorBlock: boolean
  playbackRate: number
  playbackQuality: string
  miniPlayer: boolean
  showDislikes: boolean
  showOriginalVideoTitle: boolean
  doubleTapToToggleHeader: boolean
  translateComments: boolean
  replaceWatchNavigation: boolean
  captionStyle: null
}

export const clickbaitThumbnails = ['default', 'hq1', 'hq2', 'hq3'] as const
