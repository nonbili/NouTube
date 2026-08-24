import { StyleProp } from 'react-native'

export type OnLoadEventPayload = {
  url: string
}

export type OnMessageEventPayload = {
  payload: string
}

export type NouTubeViewProps = {
  style: StyleProp<any>
  ref: React.Ref<any>
  useragent: string
  src?: string
  partition?: string
  allowpopups?: string
  pullToRefreshEnabled?: boolean
  textZoom?: number
  scriptOnStart?: string
  /* One entry per user script: each is injected on its own so a malformed
   * script cannot break the others or the content bundle. */
  userScriptsOnStart?: string[]
  onLoad?: (event: { nativeEvent: OnLoadEventPayload }) => void
  onMessage?: (event: { nativeEvent: OnMessageEventPayload }) => void
}
