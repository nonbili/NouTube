import { NativeModule, requireNativeModule } from 'expo'

declare class NouTubeViewModule extends NativeModule {}

export default requireNativeModule<NouTubeViewModule>('NouTubeView')
