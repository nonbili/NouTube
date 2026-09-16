import ExpoModulesCore
import WebKit
import AVFoundation

// Hosts YouTube itself; anything else is handed to the system browser, matching
// the Android view's shouldOverrideUrlLoading.
private let viewHostSuffixes = ["youtube.com", "youtu.be"]

private func isInAppHost(_ host: String?) -> Bool {
  guard let host = host?.lowercased() else { return false }
  if viewHostSuffixes.contains(where: { host == $0 || host.hasSuffix(".\($0)") }) {
    return true
  }
  return host.hasPrefix("accounts.google.") || host.hasPrefix("gds.google.")
}

// Tracking rather than advertising, so this stays blocked either way.
private let blockHosts = ["www.googletagmanager.com"]

// WKUserContentController retains its message handlers strongly, so the view
// registers through this instead and can still be deallocated.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
  weak var target: WKScriptMessageHandler?

  init(_ target: WKScriptMessageHandler) {
    self.target = target
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    target?.userContentController(userContentController, didReceive: message)
  }
}

public final class NouTubeView: ExpoView, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler,
  UIScrollViewDelegate {
  let onLoad = EventDispatcher()
  let onMessage = EventDispatcher()

  internal private(set) var webView: WKWebView!

  // WKWebView hands the bridge to every frame, ad iframes included. Only the
  // main frame is ever given this token (the bridge script is
  // forMainFrameOnly), so cross-origin frames cannot drive the device-level
  // setters behind it.
  private let bridgeToken = UUID().uuidString

  private var scriptOnStart = ""
  private var userScriptsOnStart: [String] = []
  private var textZoom = 100
  private var pullToRefreshEnabled = true
  private var pageUrl = ""
  private var urlObservation: NSKeyValueObservation?
  private var appStateObservers: [NSObjectProtocol] = []
  private var lastScrollY: CGFloat = 0
  private var loadErrorShown = false
  private var lastBrightness = UIScreen.main.brightness
  private var pipWakeFrames: Int?
  private let refreshControl = UIRefreshControl()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.allowsPictureInPictureMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    configuration.websiteDataStore = .default()
    configuration.processPool = NouTubeView.sharedProcessPool


    let webView = WKWebView(frame: bounds, configuration: configuration)
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    webView.scrollView.delegate = self
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    self.webView = webView
    addSubview(webView)

    // WKWebView copies the configuration it is built with, so the handler has
    // to go on the copy the view actually uses -- registering it on the
    // configuration above would leave window.webkit.messageHandlers empty.
    webView.configuration.userContentController.add(WeakScriptMessageHandler(self), name: "nouTube")

    refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    webView.scrollView.refreshControl = refreshControl

    // Navigations inside the SPA never reach the navigation delegate, so the
    // url itself is what onLoad follows (Android uses doUpdateVisitedHistory).
    urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
      self?.emitUrlIfChanged()
    }

    // The page always reports itself visible (YouTube pauses mobile web when it
    // believes it is hidden), so the real app visibility is mirrored in here
    // instead -- content/background-guard.ts reads it to tell a YouTube pause
    // apart from one the user asked for.
    for (name, background) in [
      (UIApplication.didEnterBackgroundNotification, true),
      (UIApplication.willEnterForegroundNotification, false),
    ] {
      let observer = NotificationCenter.default.addObserver(
        forName: name,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.setBackground(background)
      }
      appStateObservers.append(observer)
    }

    rebuildUserScripts()
  }

  // One pool so the two views of the split watch layout share a session.
  private static let sharedProcessPool = WKProcessPool()

  deinit {
    appStateObservers.forEach(NotificationCenter.default.removeObserver)
    urlObservation?.invalidate()
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "nouTube")
  }

  // MARK: - props

  func setScriptOnStart(_ script: String) {
    guard script != scriptOnStart else { return }
    scriptOnStart = script
    rebuildUserScripts()
  }

  func setUserScriptsOnStart(_ scripts: [String]) {
    guard scripts != userScriptsOnStart else { return }
    userScriptsOnStart = scripts
    rebuildUserScripts()
  }

  func setUserAgent(_ userAgent: String) {
    webView.customUserAgent = userAgent.isEmpty ? nil : userAgent
  }

  func setTextZoom(_ zoom: Int) {
    guard zoom != textZoom else { return }
    textZoom = zoom
    rebuildUserScripts()
    webView.evaluateJavaScript(textZoomScript, completionHandler: nil)
  }

  func setPullToRefreshEnabled(_ enabled: Bool) {
    pullToRefreshEnabled = enabled
    updateRefreshControl()
  }

  private func updateRefreshControl() {
    // /watch and /shorts scroll their own way; a refresh gesture there fights
    // the player.
    let allowed = pullToRefreshEnabled && !pageUrl.contains("/watch") && !pageUrl.contains("/shorts")
    webView.scrollView.refreshControl = allowed ? refreshControl : nil
  }

  @objc private func handleRefresh() {
    webView.reload()
  }

  // WKWebView has no textZoom of its own, so the zoom is a style rule the page
  // carries instead.
  private var textZoomScript: String {
    """
    (function () {
      var id = '_nou_text_zoom'
      var style = document.getElementById(id)
      if (!style) {
        style = document.createElement('style')
        style.id = id
        ;(document.head || document.documentElement).appendChild(style)
      }
      style.textContent = 'body, body * { -webkit-text-size-adjust: \(textZoom)% !important; }'
    })()
    """
  }

  private var bridgeScript: String {
    """
    window.NouTubeToken = '\(bridgeToken)';
    if (window.NouTubeBackground === undefined) { window.NouTubeBackground = false; }
    (function () {
      // WKWebView flips the page to hidden the moment the app leaves the
      // foreground, and YouTube pauses mobile web as soon as it sees that. The
      // Android view keeps the page visible from the native side instead
      // (NouWebView.onWindowVisibilityChanged); this is the same trick for
      // WebKit, which has no equivalent hook. The real app visibility still
      // reaches the page through window.NouTubeBackground.
      try {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: function () { return false },
        })
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: function () { return 'visible' },
        })
      } catch (e) {}
      // Swallowed in the capture phase so the page's own handlers never run.
      // Only the visibility events: pagehide and blur also fire on real
      // navigations, which YouTube needs for its own teardown.
      ;['visibilitychange', 'webkitvisibilitychange'].forEach(function (type) {
        document.addEventListener(type, function (e) { e.stopImmediatePropagation() }, true)
      })

      // Picture-in-Picture can only be armed while the app is still
      // foreground-active. AVKit refuses startPictureInPicture once the scene
      // has gone ForegroundInactive -- which it already has by
      // willResignActive -- and the player behind the video is not built until
      // something asks for it, so asking that late hands AVKit a controller
      // reporting no dimensions and no playback, which is prohibited twice
      // over. Marking the video as soon as it plays builds that player up
      // front instead, while the window can still be opened from the header
      // button. (autopictureinpicture asks WebKit to open the window on its
      // own when the app leaves; iOS 17 does not honour it, so leaving the app
      // without pressing the button still drops out of video.)
      var armPictureInPicture = function (video) {
        if (!(video instanceof HTMLVideoElement)) return
        // Only the player, never the feed previews: those are muted
        // decoration with nothing worth pinning. YouTube Music is armed too,
        // unlike Android (content/picture-in-picture.ts leaves it out there):
        // WebKit pauses a backgrounded <video> unless it is in
        // Picture-in-Picture, so the pinned window is what keeps a song
        // playing once the app leaves, artwork or not -- Android carries that
        // on the media notification instead. Its player bar also survives
        // navigation, so there is no watch path to gate on.
        var isMusic = location.hostname === 'music.youtube.com'
        if (!isMusic && location.pathname !== '/watch' && !document.fullscreenElement) return
        // YouTube marks its player as Picture-in-Picture-disabled, and WebKit
        // reads that off the attribute, so the attribute is what has to go --
        // including after YouTube replaces or reconfigures the video.
        video.removeAttribute('disablepictureinpicture')
        video.disablePictureInPicture = false
        video.autoPictureInPicture = true
        video.setAttribute('autopictureinpicture', '')
      }
      // Media events do not bubble, and YouTube swaps the video element
      // around, so listen for them on the way down instead of binding to one
      // element.
      ;['play', 'playing', 'loadedmetadata'].forEach(function (type) {
        document.addEventListener(type, function (e) { armPictureInPicture(e.target) }, true)
      })

      var post = function (name, body) {
        try {
          window.webkit.messageHandlers.nouTube.postMessage({ name: name, body: body })
        } catch (e) {}
      }
      window.NouTubeI = {
        onMessage: function (payload) { post('message', String(payload)) },
        notify: function (title, author, seconds, thumbnail) {
          post('notify', { title: title, author: author, seconds: seconds, thumbnail: thumbnail })
        },
        notifyProgress: function (playing, pos) {
          post('notifyProgress', { playing: playing, pos: pos, frames: nouPipFrames() })
        }
      }

      // The page holds several <video> elements at once (the watch player, the
      // feed previews, the miniplayer), and the pinned one is not necessarily
      // the first, so the presentation mode is what finds it.
      function nouPipVideo() {
        return Array.prototype.slice.call(document.querySelectorAll('video')).filter(function (v) {
          return v.webkitPresentationMode === 'picture-in-picture'
        })[0]
      }
      // Frames decoded by the pinned video, or -1 when nothing is pinned. The
      // native side watches this to tell a live Picture-in-Picture window from
      // one whose decode WebKit parked while the display slept.
      function nouPipFrames() {
        var v = nouPipVideo()
        if (!v) return -1
        var q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null
        return q ? q.totalVideoFrames : -1
      }
    })();
    """
  }

  private func rebuildUserScripts() {
    let controller = webView.configuration.userContentController
    controller.removeAllUserScripts()

    let add = { (source: String, mainFrameOnly: Bool) in
      guard !source.isEmpty else { return }
      controller.addUserScript(
        WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: mainFrameOnly)
      )
    }

    add(bridgeScript, true)
    add(scriptOnStart, true)
    // Each user script is its own compilation unit: a syntax error in one must
    // not take the others, or the content bundle, down with it.
    for script in userScriptsOnStart {
      add(script, true)
    }
    add(textZoomScript, true)
  }

  // MARK: - events

  func emit(_ type: String, _ data: [String: Any]) {
    onMessage(["payload": ["type": type, "data": data]])
  }

  private func emitUrlIfChanged() {
    let url = webView.url?.absoluteString ?? ""
    guard !url.isEmpty, url != pageUrl else { return }
    pageUrl = url
    updateRefreshControl()
    onLoad(["url": url])
  }

  // MARK: - WKScriptMessageHandler

  public func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard let dict = message.body as? [String: Any], let name = dict["name"] as? String else { return }
    switch name {
    case "message":
      guard let payload = dict["body"] as? String else { return }
      onMessage(["payload": payload])
    case "notify":
      guard let body = dict["body"] as? [String: Any] else { return }
      NouNowPlaying.shared.update(
        view: self,
        title: body["title"] as? String ?? "",
        author: body["author"] as? String ?? "",
        seconds: body["seconds"] as? Double ?? 0,
        thumbnail: body["thumbnail"] as? String ?? ""
      )
    case "notifyProgress":
      guard let body = dict["body"] as? [String: Any] else { return }
      let playing = body["playing"] as? Bool ?? false
      if playing {
        // Idempotent: the session is configured once, on the first play that
        // gets this far, and left alone afterwards.
        NouNowPlaying.shared.activateAudioSession()
      }
      NouNowPlaying.shared.updateProgress(
        view: self,
        playing: playing,
        position: body["pos"] as? Double ?? 0
      )
      UIApplication.shared.isIdleTimerDisabled = playing
      recoverPictureInPictureIfNeeded(playing: playing, frames: body["frames"] as? Int ?? -1)
    default:
      break
    }
  }

  // MARK: - WKNavigationDelegate

  public func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.allow)
      return
    }

    if url.scheme == "vnd.youtube.music" {
      emit("yt-music-desktop", [:])
      decisionHandler(.cancel)
      return
    }

    if blockHosts.contains(url.host?.lowercased() ?? "") {
      decisionHandler(.cancel)
      return
    }

    // Only the main frame is handed to the system browser: an ad or embed
    // iframe navigating itself must not be able to throw the user into Safari
    // (Android's shouldOverrideUrlLoading is main-frame only for the same
    // reason). targetFrame is nil for target="_blank", which createWebViewWith
    // takes from here.
    let isSubframe = navigationAction.targetFrame.map { !$0.isMainFrame } ?? false
    if isSubframe {
      decisionHandler(.allow)
      return
    }

    let scheme = url.scheme?.lowercased()
    if scheme == "http" || scheme == "https" {
      if navigationAction.targetFrame == nil || isInAppHost(url.host) {
        decisionHandler(.allow)
        return
      }
      decisionHandler(.cancel)
      UIApplication.shared.open(url)
      return
    }

    if scheme == "about" || scheme == "data" || scheme == "blob" {
      decisionHandler(.allow)
      return
    }

    decisionHandler(.cancel)
    UIApplication.shared.open(url)
  }

  public func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    emitUrlIfChanged()
  }

  public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    refreshControl.endRefreshing()
    emitUrlIfChanged()
    // The overlay outlives the failed load, so a page that does come up has to
    // take it down (Android clears it from onPageFinished).
    if loadErrorShown {
      loadErrorShown = false
      emit("load-error-cleared", [:])
    }
  }

  public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    handleLoadError(error)
  }

  public func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    handleLoadError(error)
  }

  private func handleLoadError(_ error: Error) {
    refreshControl.endRefreshing()
    let nsError = error as NSError
    // A cancelled navigation is what every in-page link looks like once the
    // next one supersedes it; it is not something to show the user.
    guard nsError.code != NSURLErrorCancelled else { return }
    loadErrorShown = true
    emit("load-error", [
      "url": (nsError.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? pageUrl,
      "code": nsError.code,
      "description": nsError.localizedDescription,
      "canReload": true,
    ])
  }

  // MARK: - WKUIDelegate

  // target="_blank" has no window to open into here, so it navigates in place.
  public func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
      if isInAppHost(url.host) {
        webView.load(navigationAction.request)
      } else {
        UIApplication.shared.open(url)
      }
    }
    return nil
  }

  // MARK: - UIScrollViewDelegate

  public func scrollViewDidScroll(_ scrollView: UIScrollView) {
    let y = scrollView.contentOffset.y
    let dy = lastScrollY - y
    lastScrollY = y
    emit("scroll", ["dy": dy, "y": y])
  }

  // MARK: - native surface

  func loadUrl(_ url: String) {
    guard let parsed = URL(string: url) else { return }
    webView.load(URLRequest(url: parsed))
  }

  func goBack() {
    if webView.canGoBack {
      webView.goBack()
    }
  }

  func clearData() async {
    let store = webView.configuration.websiteDataStore
    let types = WKWebsiteDataStore.allWebsiteDataTypes()
    let records = await store.dataRecords(ofTypes: types)
    await store.removeData(ofTypes: types, for: records)
  }

  // Turning the screen off parks the decode of a video that is already pinned:
  // the frame counter stops for good while the audio plays on, so the window
  // the user comes back to is black. The app is in the background the whole
  // time, so WebKit never hears that the display woke up -- seeking to where
  // the video already is rebuilds the decode path. (Reselecting the video
  // track would be cheaper, but WebKit does not expose video.videoTracks.)
  private static let pipNudgeScript = """
    (function () {
      var v = Array.prototype.slice.call(document.querySelectorAll('video')).filter(function (el) {
        return el.webkitPresentationMode === 'picture-in-picture'
      })[0]
      if (!v) return
      v.currentTime = v.currentTime
    })()
    """

  // The seek costs a short rebuffer, so it waits for the tick after the wake
  // to see whether the decode is running anyway -- a brief screen-off leaves
  // it alone. Progress ticks arrive about once a second.
  private func recoverPictureInPictureIfNeeded(playing: Bool, frames: Int) {
    let brightness = UIScreen.main.brightness
    let screenWokeUp = lastBrightness <= 0.01 && brightness > 0.01
    lastBrightness = brightness

    // Nothing pinned, or nothing playing: the window is not what the user is
    // looking at, and the next wake starts over.
    guard playing, frames >= 0 else {
      pipWakeFrames = nil
      return
    }

    if screenWokeUp {
      pipWakeFrames = frames
      return
    }

    guard let wakeFrames = pipWakeFrames else { return }
    pipWakeFrames = nil
    guard frames <= wakeFrames else { return }
    webView.evaluateJavaScript(NouTubeView.pipNudgeScript, completionHandler: nil)
  }

  // webkitSetPresentationMode is WebKit's own API; the standard
  // requestPictureInPicture() does not exist on iOS.
  //
  // The page holds several <video> elements at once (the watch player, the feed
  // previews, the miniplayer), and only one of them has frames to show, so the
  // decoded picture is what picks it rather than a selector.
  private var pictureInPictureScript: String {
    """
    (function () {
      var v = Array.prototype.slice
        .call(document.querySelectorAll('video'))
        .filter(function (el) { return el.readyState >= 2 && el.videoWidth > 0 })
        .sort(function (a, b) { return b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight })[0]
      if (!v) return 'no-video'
      if (typeof v.webkitSetPresentationMode !== 'function') return 'unsupported'
      if (v.webkitPresentationMode === 'picture-in-picture') {
        v.webkitSetPresentationMode('inline')
        return 'exited'
      }
      // YouTube marks its player as Picture-in-Picture-disabled, and WebKit
      // reads that off the attribute, so the attribute is what has to go --
      // including after YouTube replaces or reconfigures the video.
      v.removeAttribute('disablepictureinpicture')
      v.disablePictureInPicture = false
      if (!v.webkitSupportsPresentationMode('picture-in-picture')) return 'unsupported'
      v.webkitSetPresentationMode('picture-in-picture')
      return 'entered'
    })()
    """
  }

  // The header button is the only way in. Leaving the app used to ask for
  // Picture-in-Picture from willResignActive, which AVKit rejects every time
  // (the scene is already ForegroundInactive by then), so nothing asks for it
  // there any more -- see bridgeScript for what is armed while the video plays.
  func togglePictureInPicture() async throws -> String {
    try await evaluateJavaScript(pictureInPictureScript) ?? "no-video"
  }

  func setBackground(_ background: Bool) {
    webView.evaluateJavaScript("window.NouTubeBackground = \(background)", completionHandler: nil)
  }

  // evaluateJavaScript answers with the value itself; the Android side answers
  // with its JSON minus the quotes around a plain string, and the JS callers
  // read both shapes, so match that.
  func evaluateJavaScript(_ script: String) async throws -> String? {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.main.async {
        self.webView.evaluateJavaScript(script) { value, error in
          if let error, (error as NSError).code != WKError.javaScriptResultTypeIsUnsupported.rawValue {
            continuation.resume(throwing: error)
            return
          }
          continuation.resume(returning: NouTubeView.stringify(value))
        }
      }
    }
  }

  // An expression that evaluates to a promise is awaited instead of coming back
  // as the JSON of a promise, which is "{}".
  func evaluateJavaScriptAsync(_ script: String) async throws -> String? {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.main.async {
        self.webView.callAsyncJavaScript(
          "return await (\(script))",
          arguments: [:],
          in: nil,
          in: .page
        ) { result in
          switch result {
          case .success(let value):
            continuation.resume(returning: NouTubeView.stringify(value))
          case .failure(let error):
            continuation.resume(throwing: error)
          }
        }
      }
    }
  }

  private static func stringify(_ value: Any?) -> String? {
    guard let value, !(value is NSNull) else { return nil }
    if let string = value as? String { return string }
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]) {
      return String(data: data, encoding: .utf8)
    }
    return String(describing: value)
  }
}
