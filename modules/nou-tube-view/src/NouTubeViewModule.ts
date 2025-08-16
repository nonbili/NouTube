import { NativeModule, requireNativeModule } from 'expo'

declare class NouTubeViewModule extends NativeModule {
  executeJavaScript(script: string): Promise<string>
}

export default requireNativeModule<NouTubeViewModule>('NouTubeView')
