import ExpoModulesCore
import MediaAccessibility
import MediaPlayer
import UIKit

// Features without an iOS implementation throw rather than answer wrongly.
private func iosUnsupported(_ what: String) -> Exception {
  NouUnsupportedException(what)
}

internal final class NouUnsupportedException: GenericException<String> {
  override var reason: String {
    "\(param) is not available on iOS"
  }
}

public final class NouTubeViewModule: Module {
  private var sleepTimer: Timer?
  private var sleepTimerEndsAt: Date?
  private var localeStrings: [String: String] = [:]
  private let downloadQueue = DispatchQueue(label: "jp.nonbili.noutube.download")

  private func downloadsDirectory() throws -> URL {
    let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask,
                                             appropriateFor: nil, create: true)
    return caches.appendingPathComponent("Downloads", isDirectory: true)
  }

  private func pruneStagedDownloads() {
    guard let directory = try? downloadsDirectory(),
          let entries = try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: [.contentModificationDateKey]
          )
    else { return }
    let cutoff = Date().addingTimeInterval(-24 * 60 * 60)
    for entry in entries {
      let name = entry.lastPathComponent
      let isTemp = name.hasPrefix(".nou-") || name.hasSuffix(".part")
      let modified = (try? entry.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      if isTemp || modified < cutoff {
        try? FileManager.default.removeItem(at: entry)
      }
    }
  }

  public func definition() -> ModuleDefinition {
    Name("NouTubeView")

    Events("log", "sleepTimer", "downloadProgress", "captionStyle", "desktopMode", "pictureInPicture")

    OnCreate {
      NouNowPlaying.shared.activateAudioSession()
      self.pruneStagedDownloads()
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
      var host = settings.proxyHost.trimmingCharacters(in: .whitespacesAndNewlines)
      if host.hasPrefix("["), host.hasSuffix("]") { host = String(host.dropFirst().dropLast()) }
      NouProxy.shared.update(NouProxySettings(
        enabled: settings.proxyEnabled, type: settings.proxyType, host: host,
        port: settings.proxyPort.trimmingCharacters(in: .whitespacesAndNewlines),
        username: settings.proxyUsername, password: settings.proxyPassword
      ))
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
      (try? self.downloadsDirectory().path) ?? ""
    }

    AsyncFunction("downloadVideo") { (url: String, _: String, _: String, _: Bool, promise: Promise) in
      do {
        let directory = try self.downloadsDirectory()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let proxy = try NouProxy.shared.snapshot().ytDlpProxyURL()
        let file = try NouPythonDownload.download(url: url, directory: directory.path, proxy: proxy) { progress, line in
          self.sendEvent("downloadProgress", [
            "url": url,
            "line": line,
            "progress": progress,
            "done": false,
          ])
        }
        self.sendEvent("downloadProgress", ["url": url, "line": "", "done": true, "filePath": file])
        promise.resolve(nil)
      } catch {
        let message = error.localizedDescription
        self.sendEvent("downloadProgress", ["url": url, "line": message, "done": true, "error": true])
        promise.reject("ERR_YTDLP", message)
      }
    }.runOnQueue(downloadQueue)

    // Format selection and yt-dlp self-updates are not supported on iOS.

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
    let session = URLSession(configuration: try NouProxy.shared.sessionConfiguration())
    defer { session.invalidateAndCancel() }
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
