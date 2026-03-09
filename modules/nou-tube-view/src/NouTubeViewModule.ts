import { NativeModule, requireNativeModule } from 'expo'

declare class NouTubeViewModule extends NativeModule {
  executeJavaScript(script: string): Promise<string>
  extractTakeoutCsvFiles(uri: string): Promise<Array<{ name: string; uri: string }>>
}

export default requireNativeModule<NouTubeViewModule>('NouTubeView')
