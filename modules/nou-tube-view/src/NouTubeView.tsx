import { requireNativeView } from 'expo';
import * as React from 'react';

import { NouTubeViewProps } from './NouTubeView.types';

const NativeView: React.ComponentType<NouTubeViewProps> =
  requireNativeView('NouTubeView');

export default function NouTubeView(props: NouTubeViewProps) {
  return <NativeView {...props} />;
}
