import { $ } from 'bun'
import fs from 'fs/promises'
import packageJson from '../package.json'

const version = packageJson.version
const [major, minor, patch] = version.split('.')
const nextVersion = [major, minor, +patch + 1].join('.')

packageJson.version = nextVersion
packageJson.versionCode = packageJson.versionCode + 1

await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2) + '\n')

await $`bun expo prebuild -p android --clean`
