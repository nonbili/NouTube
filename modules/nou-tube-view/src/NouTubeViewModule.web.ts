import { registerWebModule, NativeModule } from 'expo'

class NouTubeViewModule extends NativeModule {
  extractTakeoutCsvFiles() {
    throw new Error('extractTakeoutCsvFiles is only available on Android')
  }

  async setSleepTimer() {
    throw new Error('sleep timer is only available on Android')
  }

  async clearSleepTimer() {
    throw new Error('sleep timer is only available on Android')
  }

  async getSleepTimerRemainingMs() {
    return null
  }
}

export default registerWebModule(NouTubeViewModule, 'NouTubeViewModule')
