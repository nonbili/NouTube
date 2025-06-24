import { $ } from 'bun'
import fs from 'fs/promises'
import packageJson from '../package.json'
import appJson from '../app.json'

const version = packageJson.version
const [major, minor, patch] = version.split('.')
const nextVersion = [major, minor, +patch + 1].join('.')

packageJson.version = nextVersion
appJson.expo.version = nextVersion

appJson.expo.android.versionCode = appJson.expo.android.versionCode + 1

await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2) + '\n')
await fs.writeFile('app.json', JSON.stringify(appJson, null, 2) + '\n')

await $`bun expo prebuild -p android`
