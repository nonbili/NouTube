import {
  ConfigPlugin,
  withEntitlementsPlist,
  withXcodeProject,
  withPodfile,
} from '@expo/config-plugins'

// Xcode 27 rejects deployment targets below 15.0, but some pods still declare
// older ones (RNCAsyncStorage 13.4, RNSVG 12.4), which fails the archive.
// Raise every pod to at least 15.1, matching React Native's own minimum.
const MIN_TARGET = '15.1'
const MARKER = '# noutube: raise pod deployment targets'
const POD_TARGET_FIX = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new('${MIN_TARGET}')
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
        end
      end
    end`

const withPodDeploymentTarget: ConfigPlugin = (config) =>
  withPodfile(config, (config) => {
    const podfile = config.modResults
    if (!podfile.contents.includes(MARKER)) {
      podfile.contents = podfile.contents.replace(
        /(post_install do \|installer\|\n[\s\S]*?react_native_post_install\([\s\S]*?\n\s*\))/,
        `$1\n${POD_TARGET_FIX}`,
      )
      if (!podfile.contents.includes(MARKER)) {
        throw new Error('withIosPlugin: could not find react_native_post_install in Podfile')
      }
    }
    return config
  })

// expo-notifications always adds the aps-environment entitlement, but feed
// notifications are local and need no push. The entitlement makes App Store
// export fail, because the distribution profile lacks Push Notifications.
// This plugin is listed before expo-notifications, so its mod runs after.
const withoutPushEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment']
    return config
  })

const withYtDlpBuildPhase: ConfigPlugin = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults
    const target = project.getFirstTarget()
    const name = 'Embed bundled yt-dlp runtime'
    const phases = target.firstTarget.buildPhases
    const existing = phases.findIndex((phase: { comment: string }) => phase.comment === name)
    if (existing === -1) {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', name, target.uuid, {
        shellPath: '/bin/bash',
        shellScript: 'bash "$PROJECT_DIR/../scripts/embed-ios-ytdlp.sh"',
      })
    }
    return config
  })

const withIosPlugin: ConfigPlugin = (config) =>
  withYtDlpBuildPhase(withoutPushEntitlement(withPodDeploymentTarget(config)))

export default withIosPlugin
