interface NouTubeI {
  onMessage: (payload: string) => void
  notify: (title: string, author: string, seconds: number, thumbnail: string) => void
  notifyProgress: (playing: boolean, pos: number) => void
}

declare global {
  var NouTubeI: NouTubeI
  var NouTube: any
}
