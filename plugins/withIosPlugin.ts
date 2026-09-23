import { ConfigPlugin, withAppDelegate, withInfoPlist, withPodfile } from '@expo/config-plugins'

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

// Apps built with the iOS 27 SDK fail to launch on iOS 27 unless they adopt the
// UIScene life cycle, which Expo's AppDelegate template does not do yet. Move
// the window into a SceneDelegate, and forward the scene's URL and lifecycle
// callbacks to the AppDelegate, which UIKit no longer calls with scenes.
const SCENE_MARKER = '// noutube: UIScene life cycle'
const START_REACT_NATIVE =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\n#endif\n/
const SCENE_DELEGATE = `
${SCENE_MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate else { return }

    // Linking.getInitialURL reads the URL from the launch options.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    } else if let activity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      options[.sourceApplication] = context.options.sourceApplication
      options[.openInPlace] = context.options.openInPlace
      _ = appDelegate?.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
`

const withSceneDelegate: ConfigPlugin = (config) => {
  config = withAppDelegate(config, (config) => {
    const appDelegate = config.modResults
    if (appDelegate.language !== 'swift') {
      throw new Error('withIosPlugin: expected a Swift AppDelegate')
    }
    if (!appDelegate.contents.includes(SCENE_MARKER)) {
      if (!START_REACT_NATIVE.test(appDelegate.contents)) {
        throw new Error('withIosPlugin: could not find startReactNative in AppDelegate')
      }
      appDelegate.contents =
        appDelegate.contents.replace(START_REACT_NATIVE, '') + SCENE_DELEGATE
    }
    return config
  })
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    }
    return config
  })
}

const withIosPlugin: ConfigPlugin = (config) => withSceneDelegate(withPodDeploymentTarget(config))

export default withIosPlugin
