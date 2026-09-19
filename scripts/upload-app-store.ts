#!/usr/bin/env bun

import { resolve } from 'node:path'
import {
  commandExists,
  copyFile,
  ensureFile,
  envFlag,
  fail,
  packageInfo,
  repoRoot,
  requireEnv,
  run,
} from './release-utils'

const [ipaArg] = Bun.argv.slice(2)
const pkg = await packageInfo()
const ipaPath = ipaArg ?? process.env.IPA_PATH ?? resolve(repoRoot, 'ios/build/NouTube.ipa')
const appIdentifier = process.env.IOS_APP_IDENTIFIER ?? 'jp.nonbili.noutube'
const changelogSource = process.env.IOS_CHANGELOG_SOURCE
  ?? resolve(repoRoot, `metadata/en-US/changelogs/${pkg.versionCode}04.txt`)
const releaseNotesPath = process.env.IOS_RELEASE_NOTES_PATH
  ?? resolve(repoRoot, 'fastlane/metadata/ios/en-US/release_notes.txt')
const skipBinaryUpload = envFlag('IOS_SKIP_BINARY_UPLOAD', false)
const skipBuild = envFlag('SKIP_BUILD', skipBinaryUpload)
const submitForReview = envFlag('IOS_SUBMIT_FOR_REVIEW', true)
const rejectIfPossible = envFlag('IOS_REJECT_IF_POSSIBLE', submitForReview)
const automaticRelease = envFlag('IOS_AUTOMATIC_RELEASE', true)

requireEnv('APP_STORE_KEY_ID')
requireEnv('APP_STORE_ISSUER_ID')

if (!process.env.APP_STORE_KEY_FILEPATH && !process.env.APP_STORE_KEY && !process.env.APP_STORE_KEY_CONTENT) {
  fail('set APP_STORE_KEY_FILEPATH or APP_STORE_KEY.')
}

if (process.env.APP_STORE_KEY_FILEPATH) {
  await ensureFile(
    process.env.APP_STORE_KEY_FILEPATH,
    `App Store Connect API key file not found: ${process.env.APP_STORE_KEY_FILEPATH}`,
  )
}

if (!(await commandExists('bundle'))) {
  fail("bundle not found. Install bundler and run 'bundle install'.")
}

await ensureFile(
  changelogSource,
  `Android changelog not found: ${changelogSource}\n       Expected the current versionCode changelog at metadata/en-US/changelogs/${pkg.versionCode}04.txt.`,
)
await copyFile(changelogSource, releaseNotesPath)
console.log(`Using release notes from ${changelogSource}`)

if (envFlag('PREBUILD', !skipBuild)) {
  console.log('Running clean Expo prebuild for iOS...')
  await run(['npx', 'expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install'])
}

if (!skipBuild) {
  console.log('Installing CocoaPods dependencies...')
  if (await runPodThroughBundler()) {
    await run(['bundle', 'exec', 'pod', 'install'], { cwd: resolve(repoRoot, 'ios') })
  } else {
    await run(['pod', 'install'], { cwd: resolve(repoRoot, 'ios') })
  }
}

if (!skipBinaryUpload && skipBuild) {
  await ensureFile(ipaPath, `IPA not found: ${ipaPath}`)
}

if (skipBinaryUpload && submitForReview) {
  console.log(`Submitting existing App Store Connect build ${pkg.version} (${pkg.buildNumber}) for ${appIdentifier}...`)
} else if (submitForReview) {
  console.log(`Uploading ${ipaPath} to App Store Connect and submitting for review for ${appIdentifier}...`)
} else {
  console.log(`Uploading ${ipaPath} to App Store Connect for ${appIdentifier}...`)
}

await run(['bundle', 'exec', 'fastlane', 'ios', 'upload_ipa'], {
  env: {
    IOS_APP_IDENTIFIER: appIdentifier,
    IOS_APP_VERSION: pkg.version,
    IOS_BUILD_NUMBER: pkg.buildNumber,
    IPA_PATH: ipaPath,
    IOS_RELEASE_NOTES_PATH: releaseNotesPath,
    IOS_BUILD_BEFORE_UPLOAD: skipBuild ? '0' : '1',
    IOS_SUBMIT_FOR_REVIEW: submitForReview ? '1' : '0',
    IOS_REJECT_IF_POSSIBLE: rejectIfPossible ? '1' : '0',
    IOS_AUTOMATIC_RELEASE: automaticRelease ? '1' : '0',
  },
})

console.log('Done.')

async function runPodThroughBundler() {
  const subprocess = Bun.spawn(['bundle', 'exec', 'pod', '--version'], {
    cwd: resolve(repoRoot, 'ios'),
    stdout: 'ignore',
    stderr: 'ignore',
    env: process.env,
  })

  return (await subprocess.exited) === 0
}
