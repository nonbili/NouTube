import { ConfigPlugin } from '@expo/config-plugins'
import pkg from '@expo/config-plugins'
import {
  getMainApplicationOrThrow,
  addMetaDataItemToMainApplication,
} from '@expo/config-plugins/build/android/Manifest'
import path from 'path'
import fs from 'fs'

const { withAndroidManifest, withDangerousMod } = pkg

const withAndroidAuto: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (config) => {
    const mainApplication = getMainApplicationOrThrow(config.modResults)
    addMetaDataItemToMainApplication(
      mainApplication,
      'com.google.android.gms.car.application',
      '@xml/automotive_app_desc',
      'resource',
    )
    return config
  })

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml')
      if (!fs.existsSync(resDir)) {
        await fs.promises.mkdir(resDir, { recursive: true })
      }
      await fs.promises.writeFile(
        path.join(resDir, 'automotive_app_desc.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
  <uses name="media"/>
</automotiveApp>`,
      )
      return config
    },
  ])

  return config
}

export default withAndroidAuto
