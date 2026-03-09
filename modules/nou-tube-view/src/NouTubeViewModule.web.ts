import { registerWebModule, NativeModule } from 'expo'

class NouTubeViewModule extends NativeModule {
  extractTakeoutCsvFiles() {
    throw new Error('extractTakeoutCsvFiles is only available on Android')
  }
}

export default registerWebModule(NouTubeViewModule, 'NouTubeViewModule')
