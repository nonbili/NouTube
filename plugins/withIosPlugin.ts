import { ConfigPlugin, withPodfile } from '@expo/config-plugins'

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

const withIosPlugin: ConfigPlugin = (config) =>
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

export default withIosPlugin
