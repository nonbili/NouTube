export type OnLoadEventPayload = {
  url: string
}

export type NouTubeViewProps = {
  url: string
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void
}
