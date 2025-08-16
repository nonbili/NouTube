import * as React from 'react'
import { NouTubeViewProps } from './NouTubeView.types'

export default function NouTubeView(props: NouTubeViewProps) {
  // @ts-expect-error x
  return <webview {...props} />
}
