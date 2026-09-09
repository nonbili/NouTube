import ExpoModulesCore
import MediaAccessibility
import MediaPlayer
import UIKit

// Features that only exist on the Android shell (yt-dlp downloads, the Takeout
// zip import, on-device translation) throw rather than answer wrongly; the JS
// side already guards each of them.
private func iosUnsupported(_ what: String) -> Exception {
  NouUnsupportedException(what)
}

internal final class NouUnsupportedException: GenericException<String> {
  override var reason: String {
    "\(param) is not available on iOS"
  }
}

public final class NouTubeViewModule: Module {
  private var settings = NouSettings()
  private var sleepTimer: Timer?
  private var sleepTimerEndsAt: Date?
  private var localeStrings: [String: String] = [:]

  public func definition() -> ModuleDefinition {
    Name("NouTubeView")

    Events("log", "sleepTimer", "downloadProgress", "captionStyle", "desktopMode", "pictureInPicture")

    OnCreate {
      NouNowPlaying.shared.activateAudioSession()
    }

    OnDestroy {
      self.sleepTimer?.invalidate()
      self.sleepTimer = nil
    }

    Function("getSystemCaptionStyle") {
      readCaptionStyle()
    }

    // Desktop mode is an Android-on-an-external-display concept.
    Function("isSystemDesktopMode") { false }

    // The window follows the system appearance; the JS theme drives the app
    // chrome on its own.
    Function("setTheme") { (_: String?) in }

    // iOS apps do not exit themselves.
    Function("exit") {}

    Function("setSettings") { (settings: NouSettings) in
      self.settings = settings
    }

    Function("setLocaleStrings") { (strings: [String: String]) in
      self.localeStrings = strings
    }

    AsyncFunction("fetchFeed") { (url: String) async throws -> [String: Any] in
      try await self.fetchFeed(url)
    }

    AsyncFunction("setSleepTimer") { (durationMs: Double) in
      self.startSleepTimer(durationMs)
    }

    AsyncFunction("clearSleepTimer") {
      self.stopSleepTimer(reason: "cleared")
    }

    AsyncFunction("getSleepTimerRemainingMs") { () -> Double? in
      self.remainingSleepMs()
    }

    AsyncFunction("getDownloadsPath") {
      FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.path ?? ""
    }

    // listFormats, downloadVideo, updateYtDlp, openFile and
    // extractTakeoutCsvFiles are deliberately absent: yt-dlp and the Takeout
    // zip import are Android-only, and the JS side reads a missing native
    // function as "unsupported here" rather than as an error (see
    // lib/main-client.native.ts).

    AsyncFunction("translateText") { (_: String, _: String) throws -> [String: Any] in
      throw iosUnsupported("translation")
    }

    Function("getTranslationSupportedLanguages") { [String]() }

    View(NouTubeView.self) {
      Events("onLoad", "onMessage")

      Prop("scriptOnStart") { (view: NouTubeView, script: String) in
        view.setScriptOnStart(script)
      }

      Prop("userScriptsOnStart") { (view: NouTubeView, scripts: [String]) in
        view.setUserScriptsOnStart(scripts)
      }

      Prop("useragent") { (view: NouTubeView, ua: String) in
        view.setUserAgent(ua)
      }

      Prop("pullToRefreshEnabled") { (view: NouTubeView, enabled: Bool) in
        view.setPullToRefreshEnabled(enabled)
      }

      Prop("textZoom") { (view: NouTubeView, zoom: Int) in
        view.setTextZoom(zoom)
      }

      AsyncFunction("clearData") { (view: NouTubeView) in
        await view.clearData()
      }

      AsyncFunction("executeJavaScript") { (view: NouTubeView, script: String) async throws -> String? in
        try await view.evaluateJavaScript(script)
      }

      AsyncFunction("executeJavaScriptAsync") { (view: NouTubeView, script: String) async throws -> String? in
        try await view.evaluateJavaScriptAsync(script)
      }

      AsyncFunction("goBack") { (view: NouTubeView) in
        view.goBack()
      }

      AsyncFunction("loadUrl") { (view: NouTubeView, url: String) in
        view.loadUrl(url)
      }

      AsyncFunction("claimMediaSession") { (view: NouTubeView) in
        NouNowPlaying.shared.claim(view)
      }

      AsyncFunction("togglePictureInPicture") { (view: NouTubeView) async throws -> String in
        try await view.togglePictureInPicture()
      }
    }
  }

  // MARK: - captions

  // MediaAccessibility reports each preference alongside whether the user set
  // it; the unset ones stay nil so the web side falls back to YouTube's own
  // caption styling, matching the Android has*() guards.
  private func readCaptionStyle() -> [String: Any?] {
    let domain = MACaptionAppearanceDomain.user
    let enabled = MACaptionAppearanceGetDisplayType(domain) != .automatic

    var behavior = MACaptionAppearanceBehavior.useValue
    let foreground = MACaptionAppearanceCopyForegroundColor(domain, &behavior).takeRetainedValue()
    let foregroundSet = behavior == .useValue
    var backgroundBehavior = MACaptionAppearanceBehavior.useValue
    let background = MACaptionAppearanceCopyBackgroundColor(domain, &backgroundBehavior).takeRetainedValue()
    let backgroundSet = backgroundBehavior == .useValue
    var scaleBehavior = MACaptionAppearanceBehavior.useValue
    let scale = MACaptionAppearanceGetRelativeCharacterSize(domain, &scaleBehavior)

    return [
      "enabled": enabled,
      "fontScale": scale,
      "locale": Locale.current.identifier,
      "foregroundColor": foregroundSet ? argb(foreground) : nil,
      "backgroundColor": backgroundSet ? argb(background) : nil,
      "windowColor": nil,
      "edgeType": nil,
      "edgeColor": nil,
    ]
  }

  // The web side reads these as Android packed ARGB ints.
  private func argb(_ color: CGColor) -> Int? {
    guard let converted = color.converted(
      to: CGColorSpace(name: CGColorSpace.sRGB)!,
      intent: .defaultIntent,
      options: nil
    ), let components = converted.components, components.count >= 3 else {
      return nil
    }
    let alpha = components.count >= 4 ? components[3] : 1
    let byte = { (value: CGFloat) in Int((max(0, min(1, value)) * 255).rounded()) }
    return (byte(alpha) << 24) | (byte(components[0]) << 16) | (byte(components[1]) << 8) | byte(components[2])
  }

  // MARK: - sleep timer

  private func startSleepTimer(_ durationMs: Double) {
    sleepTimer?.invalidate()
    guard durationMs > 0 else {
      stopSleepTimer(reason: "cleared")
      return
    }
    let endsAt = Date().addingTimeInterval(durationMs / 1000)
    sleepTimerEndsAt = endsAt
    DispatchQueue.main.async {
      self.sleepTimer = Timer.scheduledTimer(withTimeInterval: durationMs / 1000, repeats: false) { _ in
        self.sleepTimerEndsAt = nil
        self.sleepTimer = nil
        NouNowPlaying.shared.pause()
        self.sendEvent("sleepTimer", ["remainingMs": nil, "reason": "expired"])
      }
    }
    sendEvent("sleepTimer", ["remainingMs": durationMs, "reason": "set"])
  }

  private func stopSleepTimer(reason: String) {
    sleepTimer?.invalidate()
    sleepTimer = nil
    sleepTimerEndsAt = nil
    sendEvent("sleepTimer", ["remainingMs": nil, "reason": reason])
  }

  private func remainingSleepMs() -> Double? {
    guard let endsAt = sleepTimerEndsAt else { return nil }
    let remaining = endsAt.timeIntervalSinceNow * 1000
    return remaining > 0 ? remaining : nil
  }

  // MARK: - feeds

  private func fetchFeed(_ url: String) async throws -> [String: Any] {
    guard let parsed = URL(string: url) else {
      throw iosUnsupported("this feed url")
    }
    var request = URLRequest(url: parsed)
    request.timeoutInterval = 10
    let configuration = URLSessionConfiguration.ephemeral
    if settings.proxyEnabled, !settings.proxyHost.isEmpty, let port = Int(settings.proxyPort) {
      configuration.connectionProxyDictionary = [
        kCFNetworkProxiesHTTPEnable: 1,
        kCFNetworkProxiesHTTPProxy: settings.proxyHost,
        kCFNetworkProxiesHTTPPort: port,
      ]
    }
    let session = URLSession(configuration: configuration)
    let (data, response) = try await session.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    return [
      "ok": (200...299).contains(status),
      "status": status,
      "statusText": HTTPURLResponse.localizedString(forStatusCode: status),
      "body": String(data: data, encoding: .utf8) ?? "",
    ]
  }
}
